// Makovetzki-format Excel engine.
//
// Block 24: export is built with `exceljs` so we can emit the customer's
// fully-styled "טופס 4 / תעודת גמר" template — RTL sheet, sized columns, a
// merged bold title, a shaded header row, category sub-header bands, cell
// borders and wrapped text. Import still uses the lighter SheetJS reader
// (`xlsx`), which is all we need to parse incoming files.

import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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

// --- Export styling (exceljs) ---------------------------------------------

const CATEGORY_FALLBACK = "כללי";

// ARGB fills. Excel wants 8-digit ARGB (alpha first).
const COLOR_HEADER_FILL = "FFD9D9D9"; // light gray — header row
const COLOR_CATEGORY_FILL = "FFB7DEE8"; // light teal/blue — category bands
const COLOR_BORDER = "FF999999"; // mid gray borders

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLOR_BORDER } },
  left: { style: "thin", color: { argb: COLOR_BORDER } },
  bottom: { style: "thin", color: { argb: COLOR_BORDER } },
  right: { style: "thin", color: { argb: COLOR_BORDER } }
};

// Pull a leading "[tag]" off a task name and use it as the group category.
// "[הג\"א] בדיקת אטימות" → { category: "הג\"א", cleanName: "בדיקת אטימות" }.
// No tag → grouped under "כללי" with the name untouched.
export function extractCategory(name: string): {
  category: string;
  cleanName: string;
} {
  const m = name.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  if (m) {
    const category = m[1].trim() || CATEGORY_FALLBACK;
    const cleanName = m[2].trim() || name.trim();
    return { category, cleanName };
  }
  return { category: CATEGORY_FALLBACK, cleanName: name.trim() };
}

// Groups rows by extracted category, preserving first-seen category order so
// the sheet mirrors the on-screen task ordering.
function groupByCategory(
  rows: Array<{ requirement: string; detail: string; status: string }>
): Map<string, Array<{ requirement: string; detail: string; status: string }>> {
  const groups = new Map<
    string,
    Array<{ requirement: string; detail: string; status: string }>
  >();
  for (const r of rows) {
    const { category, cleanName } = extractCategory(r.requirement);
    const list = groups.get(category) ?? [];
    list.push({ requirement: cleanName, detail: r.detail, status: r.status });
    if (!groups.has(category)) groups.set(category, list);
  }
  return groups;
}

// Builds the fully-styled Makovetzki workbook and returns base64.
// Layout: title merged A1:C1 → gap row 2 → headers row 3 → then, per category,
// a merged sub-header band followed by that category's task rows.
export async function buildMakovetzkiWorkbook(
  title: string,
  rows: Array<{ requirement: string; detail: string; status: string }>
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("סטטוס", {
    views: [{ rightToLeft: true }]
  });

  // Readable, fixed column widths: דרישות 50 · פירוט 60 · סטאטוס 20.
  sheet.columns = [{ width: 50 }, { width: 60 }, { width: 20 }];

  // Row 1 — title, merged across the three columns.
  sheet.mergeCells("A1:C1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  // Row 2 — intentional gap (matches the customer's template).

  // Row 3 — column headers: shaded, bold, bordered, centered.
  const headerRow = sheet.getRow(3);
  const headerLabels = [HEADER_REQUIREMENTS, HEADER_DETAIL, HEADER_STATUS];
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLOR_HEADER_FILL }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  headerRow.height = 20;

  // Category groups: a merged band, then the rows beneath it.
  let rowIdx = 4;
  for (const [category, items] of groupByCategory(rows)) {
    sheet.mergeCells(rowIdx, 1, rowIdx, 3);
    const bandRow = sheet.getRow(rowIdx);
    const bandCell = bandRow.getCell(1);
    bandCell.value = category;
    bandCell.font = { bold: true, size: 12 };
    bandCell.alignment = { horizontal: "center", vertical: "middle" };
    // Border + fill must be applied to every underlying cell of the merge so
    // all four edges render (Excel only paints borders on real cells).
    for (let c = 1; c <= 3; c++) {
      const cell = bandRow.getCell(c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLOR_CATEGORY_FILL }
      };
      cell.border = thinBorder;
    }
    bandRow.height = 18;
    rowIdx++;

    for (const item of items) {
      const dataRow = sheet.getRow(rowIdx);
      const reqCell = dataRow.getCell(1);
      const detailCell = dataRow.getCell(2);
      const statusCell = dataRow.getCell(3);
      reqCell.value = item.requirement;
      detailCell.value = item.detail;
      statusCell.value = item.status;
      reqCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      detailCell.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
      statusCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      reqCell.border = thinBorder;
      detailCell.border = thinBorder;
      statusCell.border = thinBorder;
      rowIdx++;
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString("base64");
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
