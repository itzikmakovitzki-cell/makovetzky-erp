"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { todayStamp } from "@/lib/csv";
import {
  isValidPreset,
  resolveCommissionAmount,
  resolvePeriod,
  type PeriodPreset
} from "@/lib/commissions";

// Phase 4 xlsx export — assignment-level rows for the chosen period so the
// PM can hand the file to a bookkeeper. Each row in the xlsx is a single
// assignment with the resolved commission + a bucket tag (EARNED/PAID/
// OUTSTANDING). Totals row at the bottom.

export type CommissionsXlsxResult =
  | { ok: true; error: null; base64: string; filename: string }
  | { ok: false; error: string; base64: ""; filename: "" };

const HEADER_FILL = "FFD9D9D9";
const TOTAL_FILL = "FFFFE699";
const BORDER = "FF999999";

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: BORDER } },
  left: { style: "thin", color: { argb: BORDER } },
  bottom: { style: "thin", color: { argb: BORDER } },
  right: { style: "thin", color: { argb: BORDER } }
};

export async function exportCommissionsXlsx(args: {
  period: PeriodPreset;
  from: string | null;
  to: string | null;
}): Promise<CommissionsXlsxResult> {
  try {
    await requireRole(["ADMIN", "EMPLOYEE"]);
    const preset = isValidPreset(args.period) ? args.period : "month";
    const period = resolvePeriod(preset, args.from ?? undefined, args.to ?? undefined);

    const assignments = await prisma.supplierTaskAssignment.findMany({
      where: {
        task: { deletedAt: null, permit: { deletedAt: null } },
        OR: [
          {
            status: "COMPLETED",
            completedAt: { gte: period.from, lt: period.to }
          },
          { commissionPaidAt: { gte: period.from, lt: period.to } },
          {
            status: "COMPLETED",
            commissionPaidAt: null,
            completedAt: { lt: period.to }
          }
        ]
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            type: true,
            defaultCommissionType: true,
            defaultCommissionValue: true
          }
        },
        task: {
          select: {
            name: true,
            permit: { select: { name: true, permitNumber: true } }
          }
        }
      },
      orderBy: [{ supplierId: "asc" }, { completedAt: "asc" }]
    });

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("עמלות מספקים", {
      views: [{ rightToLeft: true }]
    });

    sheet.mergeCells("A1:I1");
    const titleCell = sheet.getCell("A1");
    titleCell.value = `עמלות מספקים — ${period.label}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(1).height = 28;

    sheet.columns = [
      { width: 26 }, // ספק
      { width: 18 }, // סוג
      { width: 28 }, // היתר
      { width: 32 }, // משימה
      { width: 16 }, // הושלם בתאריך
      { width: 16 }, // עמלה ₪
      { width: 14 }, // סטטוס
      { width: 16 }, // שולם בתאריך
      { width: 18 } // סוג העמלה
    ];

    const headers = [
      "ספק",
      "סוג",
      "היתר",
      "משימה",
      "הושלם בתאריך",
      "עמלה (₪)",
      "סטטוס תשלום",
      "שולם בתאריך",
      "מקור עמלה"
    ];
    const headerRow = sheet.getRow(3);
    headers.forEach((label, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = label;
      c.font = { bold: true, size: 12 };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: HEADER_FILL }
      };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = thinBorder;
    });
    headerRow.height = 22;

    let rowIdx = 4;
    let totalEarned = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const a of assignments) {
      const supplierDefault = {
        type: a.supplier.defaultCommissionType,
        value: a.supplier.defaultCommissionValue
          ? Number(a.supplier.defaultCommissionValue.toString())
          : null
      };
      const override = {
        type: a.commissionType,
        value: a.commissionValue ? Number(a.commissionValue.toString()) : null
      };
      const baseAmount = a.amount ? Number(a.amount.toString()) : null;
      const commission = resolveCommissionAmount({
        override,
        supplierDefault,
        baseAmount
      });
      if (commission === null) continue;

      const isEarnedInWindow =
        a.status === "COMPLETED" &&
        a.completedAt !== null &&
        a.completedAt >= period.from &&
        a.completedAt < period.to;
      const isPaidInWindow =
        a.commissionPaidAt !== null &&
        a.commissionPaidAt >= period.from &&
        a.commissionPaidAt < period.to;
      const isOutstanding =
        a.status === "COMPLETED" &&
        a.commissionPaidAt === null &&
        a.completedAt !== null &&
        a.completedAt < period.to;

      // A row can contribute to multiple totals (e.g. earned + paid in same
      // month). Tag captures the *current* state.
      let statusTag = "לא מסווג";
      if (a.commissionPaidAt) statusTag = "שולם";
      else if (a.status === "COMPLETED") statusTag = "מחכה לתשלום";
      else statusTag = "פעיל";

      if (isEarnedInWindow) totalEarned += commission;
      if (isPaidInWindow) totalPaid += commission;
      if (isOutstanding) totalOutstanding += commission;

      const commissionSource = a.commissionType
        ? "להקצאה זו"
        : a.supplier.defaultCommissionType
          ? "ברירת מחדל של הספק"
          : "—";

      const values = [
        a.supplier.name,
        a.supplier.type ?? "",
        a.task.permit.name,
        a.task.name,
        a.completedAt ? a.completedAt.toLocaleDateString("he-IL") : "",
        commission,
        statusTag,
        a.commissionPaidAt
          ? a.commissionPaidAt.toLocaleDateString("he-IL")
          : "",
        commissionSource
      ];
      const r = sheet.getRow(rowIdx);
      values.forEach((v, i) => {
        const c = r.getCell(i + 1);
        c.value = v;
        c.alignment = {
          vertical: "middle",
          // ExcelJS only allows left/right/center for horizontal; the
          // commission column (5) is right-aligned with tabular-nums,
          // the status column (6) is centered.
          horizontal: i === 6 ? "center" : "right",
          wrapText: true
        };
        c.border = thinBorder;
      });
      rowIdx++;
    }

    // Totals row at the bottom.
    if (rowIdx > 4) {
      const t = sheet.getRow(rowIdx);
      const cells = [
        { col: 1, value: "סה״כ בתקופה" },
        { col: 4, value: `הושלם: ${formatILS(totalEarned)}` },
        { col: 5, value: `שולם: ${formatILS(totalPaid)}` },
        { col: 6, value: `יתרה: ${formatILS(totalOutstanding)}` }
      ];
      for (let i = 1; i <= 9; i++) {
        const c = t.getCell(i);
        const match = cells.find((x) => x.col === i);
        c.value = match ? match.value : "";
        c.font = { bold: true };
        c.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: TOTAL_FILL }
        };
        c.alignment = { vertical: "middle", horizontal: "right" };
        c.border = thinBorder;
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const base64 = Buffer.from(buf as ArrayBuffer).toString("base64");
    return {
      ok: true,
      error: null,
      base64,
      filename: `makovetzki_commissions_${preset}_${todayStamp()}.xlsx`
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

function formatILS(n: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0
  }).format(n);
}
