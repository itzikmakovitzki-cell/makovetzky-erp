"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { todayStamp } from "@/lib/csv";

// Phase 3: xlsx export of the suppliers overview. Reuses the Block-24 styled-
// export pattern (exceljs) — RTL sheet, sized columns, bordered header, no
// pivot / formulas (the customer wants a flat list they can paste into their
// own accounting workflow).

export type SuppliersXlsxResult =
  | { ok: true; error: null; base64: string; filename: string }
  | { ok: false; error: string; base64: ""; filename: "" };

const HEADER_FILL = "FFD9D9D9";
const BORDER = "FF999999";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER } },
  left: { style: "thin", color: { argb: BORDER } },
  bottom: { style: "thin", color: { argb: BORDER } },
  right: { style: "thin", color: { argb: BORDER } }
};

export async function exportSuppliersXlsx(): Promise<SuppliersXlsxResult> {
  try {
    await requireRole(["ADMIN", "EMPLOYEE"]);
    const suppliers = await prisma.supplier.findMany({
      where: { deletedAt: null },
      include: {
        taskAssignments: {
          where: {
            status: { in: ["OPEN", "IN_PROGRESS"] },
            task: { deletedAt: null, permit: { deletedAt: null } }
          },
          select: { id: true, amount: true }
        }
      },
      orderBy: { name: "asc" }
    });

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("ספקים", { views: [{ rightToLeft: true }] });

    // Column widths sized so the customer can paste the file into Google
    // Sheets / Excel without resizing every column.
    sheet.columns = [
      { width: 30 }, // שם
      { width: 18 }, // סוג
      { width: 22 }, // שירותים
      { width: 20 }, // איש קשר
      { width: 18 }, // טלפון
      { width: 28 }, // אימייל
      { width: 28 }, // אתר
      { width: 18 }, // עמלת ברירת מחדל
      { width: 20 }, // תנאי תשלום
      { width: 16 }, // משימות פתוחות
      { width: 18 } // סכום פתוח
    ];

    const headerLabels = [
      "שם",
      "סוג",
      "שירותים",
      "איש קשר",
      "טלפון",
      "אימייל",
      "אתר",
      "עמלת ברירת מחדל",
      "תנאי תשלום",
      "משימות פתוחות",
      "סכום פתוח (₪)"
    ];
    const headerRow = sheet.getRow(1);
    headerLabels.forEach((label, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = label;
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

    suppliers.forEach((s, idx) => {
      const row = sheet.getRow(idx + 2);
      const openCount = s.taskAssignments.length;
      const openAmount = s.taskAssignments.reduce(
        (sum, a) => sum + (a.amount ? Number(a.amount.toString()) : 0),
        0
      );
      const commission =
        s.defaultCommissionType === "FIXED" && s.defaultCommissionValue
          ? `${s.defaultCommissionValue.toString()} ₪`
          : s.defaultCommissionType === "PERCENT" && s.defaultCommissionValue
            ? `${s.defaultCommissionValue.toString()}%`
            : "";

      const values = [
        s.name,
        s.type ?? "",
        s.services ?? "",
        s.contactName ?? "",
        s.phone ?? "",
        s.email ?? "",
        s.website ?? "",
        commission,
        s.defaultPaymentTerms ?? "",
        openCount,
        openAmount
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v;
        cell.alignment = {
          vertical: "middle",
          horizontal: i >= 9 ? "center" : "right",
          wrapText: true
        };
        cell.border = thinBorder;
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf as ArrayBuffer).toString("base64");
    return {
      ok: true,
      error: null,
      base64,
      filename: `makovetzki_suppliers_${todayStamp()}.xlsx`
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      base64: "",
      filename: ""
    };
  }
}
