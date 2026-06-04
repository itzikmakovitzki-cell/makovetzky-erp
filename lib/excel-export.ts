// Shared building blocks for the per-list Excel exporters. Mirrors the
// commissions-xlsx styling (RTL, gray header, totals row in soft yellow,
// thin gray borders) so every exported file looks the same.

import ExcelJS from "exceljs";

export const HEADER_FILL = "FFD9D9D9";
export const TOTAL_FILL = "FFFFE699";
export const BORDER = "FF999999";

export const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER } },
  left: { style: "thin", color: { argb: BORDER } },
  bottom: { style: "thin", color: { argb: BORDER } },
  right: { style: "thin", color: { argb: BORDER } }
};

export type ColumnSpec = {
  header: string;
  width: number;
  // Optional formatter — receives the raw row value and returns the value
  // ExcelJS should write (string / number / Date).
  // Default: cast to string.
  format?: (v: unknown) => string | number | Date | null;
};

// Convenience constructor for an RTL worksheet with a merged title row at
// the top, a styled header row at row 3, and a body that starts at row 4.
// Returns the workbook so the caller can fill rows + finalize.
export function buildSheet(args: {
  title: string;
  columns: ColumnSpec[];
}): { workbook: ExcelJS.Workbook; sheet: ExcelJS.Worksheet } {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(args.title.slice(0, 30), {
    views: [{ rightToLeft: true }]
  });

  const colCount = args.columns.length;
  const lastCol = String.fromCharCode("A".charCodeAt(0) + colCount - 1);
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = args.title;
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 28;

  sheet.columns = args.columns.map((c) => ({ width: c.width }));

  const headerRow = sheet.getRow(3);
  args.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL }
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  headerRow.height = 22;

  return { workbook: wb, sheet };
}

// Writes one body row. Row index is 1-based and includes the title (row 1)
// and header (row 3), so the first body row is rowIdx=4.
export function writeBodyRow(
  sheet: ExcelJS.Worksheet,
  rowIdx: number,
  values: Array<string | number | Date | null>
) {
  const row = sheet.getRow(rowIdx);
  values.forEach((v, i) => {
    const cell = row.getCell(i + 1);
    cell.value = v;
    cell.alignment = {
      vertical: "middle",
      horizontal: typeof v === "number" ? "left" : "right",
      wrapText: true
    };
    cell.border = thinBorder;
  });
}

// Optional totals row at the bottom. `cells` is sparse — only columns you
// want filled need entries; the rest get an empty string but still pick up
// the bold + yellow fill so the strip reads as one row.
export function writeTotalsRow(
  sheet: ExcelJS.Worksheet,
  rowIdx: number,
  cells: Array<{ col: number; value: string | number }>
) {
  const row = sheet.getRow(rowIdx);
  const maxCol = sheet.columnCount;
  for (let i = 1; i <= maxCol; i++) {
    const cell = row.getCell(i);
    const match = cells.find((c) => c.col === i);
    cell.value = match ? match.value : "";
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: TOTAL_FILL }
    };
    cell.alignment = { vertical: "middle", horizontal: "right" };
    cell.border = thinBorder;
  }
}

// Final step — turn the workbook into the base64 string the client button
// expects to download. Wrapped here so each exporter has one less import.
export async function workbookToBase64(
  workbook: ExcelJS.Workbook
): Promise<string> {
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer).toString("base64");
}

export type XlsxResult =
  | { ok: true; error: null; base64: string; filename: string }
  | { ok: false; error: string; base64: ""; filename: "" };

export function formatILSPlain(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0
  }).format(n);
}

export function formatDateHe(d: Date | null | undefined): string {
  return d ? d.toLocaleDateString("he-IL") : "";
}
