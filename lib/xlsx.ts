// Makovetzki-format Excel engine. The community `xlsx` package (SheetJS CE)
// reads/writes .xlsx structure but does not emit cell styling — values,
// merges, column widths, and RTL view direction are all we can rely on.
// That's enough to reproduce the customer's "טופס 4 / תעודת גמר" status
// table: a title spanning A1:C1, headers in row 3, data from row 4 down.

import * as XLSX from "xlsx";
import type { TaskStatus } from "@prisma/client";

// Exact spelling the customer uses in their template. Header detection on
// import looks for *this string* in any cell to locate the header row.
export const HEADER_REQUIREMENTS = "דרישות";
export const HEADER_DETAIL = "פירוט";
export const HEADER_STATUS = "סטאטוס";

// Hebrew labels we *write* on export. COMPLETED → "התקבל" matches the
// customer's vocabulary on the original template; the other four mirror
// the in-app labels.
export const TASK_STATUS_TO_MAKOVETZKI_HE: Record<TaskStatus, string> = {
  OPEN: "פתוח",
  IN_PROGRESS: "בתהליך",
  AWAITING_AUTHORITY: "ממתין לרשות",
  COMPLETED: "התקבל",
  BLOCKED: "חסום"
};

// Permissive reverse map for import. Keys are normalised (trim + lowercase)
// before lookup, so "הושלם" / "אושר" / "התקבל" all resolve to COMPLETED.
// Anything not in this map keeps the cell text as a description suffix.
const MAKOVETZKI_HE_TO_TASK_STATUS: Record<string, TaskStatus> = {
  פתוח: "OPEN",
  חדש: "OPEN",
  בתהליך: "IN_PROGRESS",
  בעבודה: "IN_PROGRESS",
  בעיבוד: "IN_PROGRESS",
  "ממתין לרשות": "AWAITING_AUTHORITY",
  ממתין: "AWAITING_AUTHORITY",
  הושלם: "COMPLETED",
  התקבל: "COMPLETED",
  אושר: "COMPLETED",
  בוצע: "COMPLETED",
  חסום: "BLOCKED",
  מעוכב: "BLOCKED",
  נדחה: "BLOCKED"
};

export function mapHebrewStatusToEnum(raw: string): TaskStatus | null {
  const norm = raw.trim();
  if (!norm) return null;
  return MAKOVETZKI_HE_TO_TASK_STATUS[norm] ?? null;
}

export type XlsxExportResult = {
  ok: boolean;
  error: string | null;
  // Base64-encoded .xlsx bytes — server actions can't return Buffer/Uint8Array,
  // and we want to keep the binary intact until the browser decodes it for
  // the download blob.
  base64: string;
  filename: string;
};

export type XlsxImportResult = {
  ok: boolean;
  error: string | null;
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

export const EMPTY_XLSX_IMPORT_RESULT: XlsxImportResult = {
  ok: false,
  error: null,
  created: 0,
  skipped: 0,
  errors: []
};

export type MakovetzkiTaskRow = {
  // The 1-based source row number in the user's file — used in error
  // messages so they can locate problem rows in Excel directly.
  sourceRow: number;
  name: string;
  description: string | null;
  rawStatus: string;
};

// Builds a Makovetzki-format workbook in memory and returns base64.
// title goes into A1 (merged A1:C1); headers occupy row 3; data starts row 4.
export function buildMakovetzkiWorkbook(
  title: string,
  rows: Array<{ requirement: string; detail: string; status: string }>
): string {
  // Empty-cell row 2 leaves a visual gap between title and header — matches
  // the customer's template.
  const aoa: (string | null)[][] = [
    [title, null, null],
    [null, null, null],
    [HEADER_REQUIREMENTS, HEADER_DETAIL, HEADER_STATUS]
  ];
  for (const r of rows) {
    aoa.push([r.requirement, r.detail, r.status]);
  }

  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Merge A1:C1 so the title visually spans the three data columns.
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  // Widths chosen so the שם המשימה / תיאור columns aren't truncated when
  // opened cold in Excel. RTL is set at the worksheet view level below.
  sheet["!cols"] = [{ wch: 38 }, { wch: 52 }, { wch: 18 }];
  // SheetJS reads this property to write <sheetView rightToLeft="1"/>
  // — Excel then opens the sheet with columns running R→L like the
  // customer's template. Not in SheetJS' published types; cast through
  // unknown to keep this contained.
  (sheet as unknown as { "!views": { RTL: boolean }[] })["!views"] = [
    { RTL: true }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "סטטוס");

  const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  // Node Buffer or Uint8Array depending on the runtime; both base64-encode
  // via Buffer.from(...).toString.
  return Buffer.from(buf).toString("base64");
}

// Locates the header row by searching for a cell containing exactly
// "דרישות" anywhere in the sheet. Returns the row + column indexes
// of the three target headers. Tolerates "סטטוס" *and* "סטאטוס" since
// both spellings circulate in the wild.
function findHeaderRow(
  sheet: XLSX.WorkSheet
): { headerRow: number; reqCol: number; detailCol: number; statusCol: number } | null {
  if (!sheet["!ref"]) return null;
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    // First find a "דרישות" cell on this row.
    let reqCol = -1;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = String(cell.v ?? "").trim();
      if (v === HEADER_REQUIREMENTS) {
        reqCol = c;
        break;
      }
    }
    if (reqCol < 0) continue;

    // Same row: locate פירוט and the status column (either spelling).
    let detailCol = -1;
    let statusCol = -1;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = String(cell.v ?? "").trim();
      if (v === HEADER_DETAIL) detailCol = c;
      else if (v === HEADER_STATUS || v === "סטטוס") statusCol = c;
    }
    if (detailCol < 0 || statusCol < 0) continue;
    return { headerRow: r, reqCol, detailCol, statusCol };
  }
  return null;
}

// Parses .xlsx bytes into Makovetzki rows. Edge case from the spec:
// if `דרישות` is blank but `פירוט` has text (e.g. a sub-stage of a
// building), the פירוט text becomes the task name and description is
// left null. If both are present, name = `דרישות` and description = `פירוט`.
// Rows where both columns are blank are skipped silently.
export function parseMakovetzkiWorkbook(
  bytes: Uint8Array
): { ok: true; rows: MakovetzkiTaskRow[] } | { ok: false; error: string } {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: "array" });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "קובץ אקסל לא תקין"
    };
  }
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { ok: false, error: "הקובץ אינו מכיל גיליון" };
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet["!ref"]) {
    return { ok: false, error: "הגיליון ריק" };
  }
  const header = findHeaderRow(sheet);
  if (!header) {
    return {
      ok: false,
      error: 'לא נמצאה שורת כותרת — נדרש תא עם הערך "דרישות"'
    };
  }
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const rows: MakovetzkiTaskRow[] = [];
  for (let r = header.headerRow + 1; r <= range.e.r; r++) {
    const reqCell = sheet[XLSX.utils.encode_cell({ r, c: header.reqCol })];
    const detailCell = sheet[XLSX.utils.encode_cell({ r, c: header.detailCol })];
    const statusCell = sheet[XLSX.utils.encode_cell({ r, c: header.statusCol })];
    const req = String(reqCell?.v ?? "").trim();
    const detail = String(detailCell?.v ?? "").trim();
    const status = String(statusCell?.v ?? "").trim();
    if (!req && !detail) continue;

    let name: string;
    let description: string | null;
    if (req && detail) {
      name = req;
      description = detail;
    } else if (req) {
      name = req;
      description = null;
    } else {
      // Sub-stage row — פירוט carries the actual line item.
      name = detail;
      description = null;
    }
    rows.push({
      sourceRow: r + 1, // 1-based for the user
      name,
      description,
      rawStatus: status
    });
  }
  return { ok: true, rows };
}
