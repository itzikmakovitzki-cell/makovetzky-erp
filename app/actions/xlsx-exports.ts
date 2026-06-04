"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { todayStamp } from "@/lib/csv";
import {
  buildSheet,
  formatDateHe,
  formatILSPlain,
  workbookToBase64,
  writeBodyRow,
  writeTotalsRow,
  type XlsxResult
} from "@/lib/excel-export";

// Generic per-entity Excel exporter. Each `kind` maps to a SELECT + a sheet
// definition. The button in the UI knows nothing about the entity — it just
// hands a string here and asks for bytes back.
export type XlsxExportKind =
  | "proposals"
  | "clients"
  | "permits"
  | "tasks"
  | "suppliers"
  | "projects";

export async function exportListXlsx(args: {
  kind: XlsxExportKind;
}): Promise<XlsxResult> {
  try {
    await requireRole(["ADMIN", "EMPLOYEE"]);
    switch (args.kind) {
      case "proposals":
        return await exportProposals();
      case "clients":
        return await exportClients();
      case "permits":
        return await exportPermits();
      case "tasks":
        return await exportTasks();
      case "suppliers":
        return await exportSuppliers();
      case "projects":
        return await exportProjects();
      default:
        return {
          ok: false,
          error: `סוג ייצוא לא מוכר: ${args.kind}`,
          base64: "",
          filename: ""
        };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      base64: "",
      filename: ""
    };
  }
}

const STATUS_LABEL_HE: Record<string, string> = {
  // ProposalStatus
  DRAFT: "טיוטה",
  SENT: "נשלחה",
  SIGNED: "נחתמה",
  REJECTED: "נדחתה",
  // MasterDealStatus
  ACTIVE: "פעיל",
  ON_HOLD: "מושהה",
  COMPLETED: "הושלם",
  CANCELED: "בוטל",
  // PermitStatus
  IN_PROGRESS: "בעבודה",
  // TaskStatus
  OPEN: "פתוח",
  BLOCKED: "חסום",
  DONE: "הושלם"
};

const heStatus = (s: string | null) =>
  s ? STATUS_LABEL_HE[s] ?? s : "";

async function exportProposals(): Promise<XlsxResult> {
  const rows = await prisma.proposal.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      projectLocation: true,
      totalAmount: true,
      pricesIncludeVat: true,
      status: true,
      sentAt: true,
      expiresAt: true,
      signedAt: true,
      signedName: true,
      signedIdNumber: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  const { workbook, sheet } = buildSheet({
    title: "הצעות מחיר",
    columns: [
      { header: "לקוח", width: 26 },
      { header: "טלפון", width: 16 },
      { header: "אימייל", width: 24 },
      { header: "מיקום", width: 26 },
      { header: "סכום", width: 14 },
      { header: "מע״מ", width: 12 },
      { header: "סטטוס", width: 12 },
      { header: "נשלחה", width: 14 },
      { header: "תקפה עד", width: 14 },
      { header: "נחתמה", width: 14 },
      { header: "שם החותם", width: 22 },
      { header: "ת.ז", width: 14 },
      { header: "נוצרה", width: 14 }
    ]
  });

  let rowIdx = 4;
  let totalSent = 0;
  let totalSigned = 0;
  for (const p of rows) {
    const amount = Number(p.totalAmount.toString());
    writeBodyRow(sheet, rowIdx++, [
      p.customerName,
      p.customerPhone,
      p.customerEmail ?? "",
      p.projectLocation ?? "",
      amount,
      p.pricesIncludeVat ? "כולל מע״מ" : "לפני מע״מ",
      heStatus(p.status),
      formatDateHe(p.sentAt),
      formatDateHe(p.expiresAt),
      formatDateHe(p.signedAt),
      p.signedName ?? "",
      p.signedIdNumber ?? "",
      formatDateHe(p.createdAt)
    ]);
    if (p.status === "SENT" || p.status === "SIGNED") totalSent += amount;
    if (p.status === "SIGNED") totalSigned += amount;
  }

  if (rowIdx > 4) {
    writeTotalsRow(sheet, rowIdx, [
      { col: 1, value: "סה״כ" },
      { col: 4, value: `נשלחו / חתומות: ${formatILSPlain(totalSent)}` },
      { col: 5, value: `חתומות בלבד: ${formatILSPlain(totalSigned)}` }
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_proposals_${todayStamp()}.xlsx`
  };
}

async function exportClients(): Promise<XlsxResult> {
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    select: {
      companyName: true,
      hp: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      notes: true,
      createdAt: true,
      _count: { select: { masterDeals: true } }
    },
    orderBy: { companyName: "asc" }
  });

  const { workbook, sheet } = buildSheet({
    title: "לקוחות",
    columns: [
      { header: "שם חברה", width: 28 },
      { header: "ח.פ", width: 14 },
      { header: "איש קשר", width: 22 },
      { header: "טלפון", width: 16 },
      { header: "אימייל", width: 24 },
      { header: "כתובת", width: 28 },
      { header: "פרויקטים", width: 12 },
      { header: "הערות", width: 30 },
      { header: "הוקם", width: 14 }
    ]
  });

  let rowIdx = 4;
  for (const c of rows) {
    writeBodyRow(sheet, rowIdx++, [
      c.companyName,
      c.hp ?? "",
      c.contactName,
      c.phone,
      c.email ?? "",
      c.address ?? "",
      c._count.masterDeals,
      c.notes ?? "",
      formatDateHe(c.createdAt)
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_clients_${todayStamp()}.xlsx`
  };
}

async function exportPermits(): Promise<XlsxResult> {
  const rows = await prisma.permit.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      permitNumber: true,
      type: true,
      status: true,
      progressPercent: true,
      startDate: true,
      expectedCloseDate: true,
      closedAt: true,
      createdAt: true,
      masterDeal: { select: { name: true, client: { select: { companyName: true } } } },
      authority: { select: { name: true } },
      _count: { select: { tasks: true, documents: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const { workbook, sheet } = buildSheet({
    title: "היתרים",
    columns: [
      { header: "שם", width: 28 },
      { header: "מס׳ היתר", width: 16 },
      { header: "סוג", width: 14 },
      { header: "סטטוס", width: 12 },
      { header: "% התקדמות", width: 12 },
      { header: "פרויקט", width: 24 },
      { header: "לקוח", width: 24 },
      { header: "רשות", width: 22 },
      { header: "התחלה", width: 14 },
      { header: "יעד סגירה", width: 14 },
      { header: "נסגר", width: 14 },
      { header: "משימות", width: 10 },
      { header: "מסמכים", width: 10 },
      { header: "הוקם", width: 14 }
    ]
  });

  let rowIdx = 4;
  for (const p of rows) {
    writeBodyRow(sheet, rowIdx++, [
      p.name,
      p.permitNumber ?? "",
      p.type ?? "",
      heStatus(p.status),
      p.progressPercent,
      p.masterDeal.name,
      p.masterDeal.client.companyName,
      p.authority.name,
      formatDateHe(p.startDate),
      formatDateHe(p.expectedCloseDate),
      formatDateHe(p.closedAt),
      p._count.tasks,
      p._count.documents,
      formatDateHe(p.createdAt)
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_permits_${todayStamp()}.xlsx`
  };
}

async function exportTasks(): Promise<XlsxResult> {
  const rows = await prisma.task.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      dueDate: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
      permit: {
        select: {
          name: true,
          masterDeal: {
            select: { name: true, client: { select: { companyName: true } } }
          }
        }
      },
      assignee: { select: { name: true } }
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });

  const { workbook, sheet } = buildSheet({
    title: "משימות",
    columns: [
      { header: "משימה", width: 32 },
      { header: "סטטוס", width: 12 },
      { header: "עדיפות", width: 12 },
      { header: "קטגוריה", width: 18 },
      { header: "היתר", width: 22 },
      { header: "פרויקט", width: 22 },
      { header: "לקוח", width: 22 },
      { header: "אחראי", width: 18 },
      { header: "תאריך יעד", width: 14 },
      { header: "התחיל", width: 14 },
      { header: "הושלם", width: 14 },
      { header: "נוצרה", width: 14 }
    ]
  });

  let rowIdx = 4;
  for (const t of rows) {
    writeBodyRow(sheet, rowIdx++, [
      t.name,
      heStatus(t.status),
      t.priority,
      t.category ?? "",
      t.permit.name,
      t.permit.masterDeal.name,
      t.permit.masterDeal.client.companyName,
      t.assignee?.name ?? "",
      formatDateHe(t.dueDate),
      formatDateHe(t.startedAt),
      formatDateHe(t.completedAt),
      formatDateHe(t.createdAt)
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_tasks_${todayStamp()}.xlsx`
  };
}

async function exportSuppliers(): Promise<XlsxResult> {
  const rows = await prisma.supplier.findMany({
    select: {
      name: true,
      type: true,
      contactName: true,
      phone: true,
      email: true,
      services: true,
      defaultCommissionType: true,
      defaultCommissionValue: true,
      defaultPaymentTerms: true,
      notes: true,
      createdAt: true,
      _count: { select: { taskAssignments: true } }
    },
    orderBy: { name: "asc" }
  });

  const { workbook, sheet } = buildSheet({
    title: "ספקים",
    columns: [
      { header: "שם", width: 28 },
      { header: "סוג", width: 16 },
      { header: "איש קשר", width: 22 },
      { header: "טלפון", width: 16 },
      { header: "אימייל", width: 24 },
      { header: "שירותים", width: 30 },
      { header: "סוג עמלה", width: 14 },
      { header: "ערך עמלה", width: 14 },
      { header: "תנאי תשלום", width: 16 },
      { header: "הקצאות", width: 12 },
      { header: "הערות", width: 28 },
      { header: "הוקם", width: 14 }
    ]
  });

  let rowIdx = 4;
  for (const s of rows) {
    writeBodyRow(sheet, rowIdx++, [
      s.name,
      s.type ?? "",
      s.contactName ?? "",
      s.phone ?? "",
      s.email ?? "",
      s.services ?? "",
      s.defaultCommissionType ?? "",
      s.defaultCommissionValue
        ? Number(s.defaultCommissionValue.toString())
        : "",
      s.defaultPaymentTerms ?? "",
      s._count.taskAssignments,
      s.notes ?? "",
      formatDateHe(s.createdAt)
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_suppliers_${todayStamp()}.xlsx`
  };
}

async function exportProjects(): Promise<XlsxResult> {
  const rows = await prisma.masterDeal.findMany({
    where: { deletedAt: null },
    select: {
      name: true,
      status: true,
      totalValue: true,
      contractDate: true,
      createdAt: true,
      client: { select: { companyName: true, contactName: true, phone: true } },
      _count: { select: { permits: true, dealMilestones: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  const { workbook, sheet } = buildSheet({
    title: "פרויקטים",
    columns: [
      { header: "שם הפרויקט", width: 32 },
      { header: "סטטוס", width: 12 },
      { header: "שווי", width: 14 },
      { header: "תאריך חוזה", width: 14 },
      { header: "לקוח", width: 24 },
      { header: "איש קשר", width: 22 },
      { header: "טלפון", width: 16 },
      { header: "היתרים", width: 10 },
      { header: "אבני דרך", width: 12 },
      { header: "הוקם", width: 14 }
    ]
  });

  let rowIdx = 4;
  let totalValue = 0;
  for (const d of rows) {
    const value = d.totalValue ? Number(d.totalValue.toString()) : 0;
    writeBodyRow(sheet, rowIdx++, [
      d.name,
      heStatus(d.status),
      value,
      formatDateHe(d.contractDate),
      d.client.companyName,
      d.client.contactName,
      d.client.phone,
      d._count.permits,
      d._count.dealMilestones,
      formatDateHe(d.createdAt)
    ]);
    totalValue += value;
  }

  if (rowIdx > 4) {
    writeTotalsRow(sheet, rowIdx, [
      { col: 1, value: "סה״כ" },
      { col: 3, value: formatILSPlain(totalValue) }
    ]);
  }

  return {
    ok: true,
    error: null,
    base64: await workbookToBase64(workbook),
    filename: `makovetzki_projects_${todayStamp()}.xlsx`
  };
}
