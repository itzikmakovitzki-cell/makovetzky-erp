// Minimal CSV utilities for import/export. Server-side parser handles the
// RFC-4180 subset that Excel emits: quoted fields, embedded commas/quotes/
// newlines, and CRLF or LF line endings. Exports prepend the UTF-8 BOM so
// Excel-on-Windows detects the encoding and renders Hebrew correctly.

// UTF-8 BOM (U+FEFF). Without this prefix, Excel-on-Windows fails to
// auto-detect the UTF-8 encoding of a .csv file and silently mojibakes
// Hebrew column headers and values. The literal character is what ends
// up in the file bytes; the comment is the only spot that names it.
export const UTF8_BOM = "﻿";

export type ImportResult = {
  ok: boolean;
  error: string | null;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export type ExportResult = {
  ok: boolean;
  error: string | null;
  csv: string;
  filename: string;
};

export const EMPTY_IMPORT_RESULT: ImportResult = {
  ok: false,
  error: null,
  created: 0,
  skipped: 0,
  errors: []
};

// Strict-ish RFC-4180 parser. Handles a leading BOM (strips silently),
// quoted cells with "" escaping, mixed CRLF / LF line endings, and trims a
// trailing blank row produced by a final newline.
export function parseCsv(input: string): string[][] {
  if (input.length === 0) return [];
  let i = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  while (i < input.length) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      if (input[i] === "\n") i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === "") rows.pop();
  }
  return rows;
}

export function rowsToObjects(
  rows: string[][]
): { headers: string[]; data: Record<string, string>[] } | null {
  if (rows.length === 0) return null;
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, data };
}

function escapeCell(value: string): string {
  if (value === "") return value;
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Builds a CSV string with the UTF-8 BOM prepended and CRLF line endings
// (Excel-on-Windows convention).
export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][]
): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCell).join(","));
  for (const row of rows) {
    lines.push(
      row
        .map((v) => {
          if (v === null || v === undefined) return "";
          return escapeCell(typeof v === "string" ? v : String(v));
        })
        .join(",")
    );
  }
  return UTF8_BOM + lines.join("\r\n");
}

// Accepts ISO (YYYY-MM-DD), dd/MM/yyyy, or dd.MM.yyyy. Falls back to the
// native Date parser for anything else. Returns null on blanks; returns
// null (not throws) on unparseable input so callers can report row-level
// errors cleanly.
export function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// dd/MM/yyyy with zero-padding — matches lib/utils.ts formatDate so exports
// look like everything else in the UI.
export function formatDateForCsv(d: Date | null | undefined): string {
  if (!d) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

// Filename-safe variant of a Hebrew/English string. Excel and Windows
// tolerate Hebrew filenames but underscoring non-letter/digit runs keeps
// downloads predictable.
export function safeFileSegment(s: string): string {
  return s.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60);
}

export function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
