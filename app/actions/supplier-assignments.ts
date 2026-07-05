"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  Prisma,
  SupplierAssignmentStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { validateCommissionPair } from "@/lib/commissions";
import { parseDate } from "@/lib/validators/form";

// Phase 2 of the suppliers overhaul — write side for SupplierTaskAssignment.
// The previous codebase had read-only views (seed.ts was the only writer);
// these actions are the first user-facing create/edit/delete/mark-paid flow.

export type AssignmentFormState = { error: string | null; ok: boolean };

const VALID_STATUSES: SupplierAssignmentStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED"
];

// --- Helpers ---------------------------------------------------------------

function parseCommission(formData: FormData) {
  return validateCommissionPair(
    String(formData.get("commissionType") || ""),
    String(formData.get("commissionValue") || "")
  );
}

function readAssignmentForm(formData: FormData): {
  supplierId: string;
  taskId: string;
  status: SupplierAssignmentStatus;
  amount: string | null;
  paymentTerms: string | null;
  dueDate: Date | null;
  notes: string | null;
} {
  const statusRaw = String(formData.get("status") || "OPEN").trim();
  const status = VALID_STATUSES.includes(statusRaw as SupplierAssignmentStatus)
    ? (statusRaw as SupplierAssignmentStatus)
    : "OPEN";
  const amountRaw = String(formData.get("amount") || "").trim();
  let amount: string | null = null;
  if (amountRaw) {
    const n = Number(amountRaw);
    if (!Number.isNaN(n) && n >= 0) amount = n.toFixed(2);
  }
  return {
    supplierId: String(formData.get("supplierId") || "").trim(),
    taskId: String(formData.get("taskId") || "").trim(),
    status,
    amount,
    paymentTerms: String(formData.get("paymentTerms") || "").trim() || null,
    dueDate: parseDate(formData.get("dueDate")),
    notes: String(formData.get("notes") || "").trim() || null
  };
}

// --- Actions ---------------------------------------------------------------

export async function createSupplierAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const fields = readAssignmentForm(formData);
    if (!fields.supplierId) return { error: "חסר ספק", ok: false };
    if (!fields.taskId) return { error: "חסרה משימה", ok: false };

    const commission = parseCommission(formData);
    if (!commission.ok) return { error: commission.error, ok: false };

    // Sanity-check both ends exist + the task isn't soft-deleted, so we can
    // give a clean error instead of a Prisma FK explosion.
    const [supplier, task] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: fields.supplierId, deletedAt: null } }),
      prisma.task.findFirst({
        where: { id: fields.taskId, deletedAt: null },
        select: { id: true, permitId: true }
      })
    ]);
    if (!supplier) return { error: "הספק לא נמצא", ok: false };
    if (!task) return { error: "המשימה לא נמצאה", ok: false };

    await prisma.$transaction(async (tx) => {
      const a = await tx.supplierTaskAssignment.create({
        data: {
          supplierId: fields.supplierId,
          taskId: fields.taskId,
          status: fields.status,
          amount: fields.amount ? new Prisma.Decimal(fields.amount) : null,
          commissionType: commission.type,
          commissionValue: commission.value
            ? new Prisma.Decimal(commission.value)
            : null,
          paymentTerms: fields.paymentTerms,
          dueDate: fields.dueDate,
          notes: fields.notes,
          completedAt: fields.status === "COMPLETED" ? new Date() : null
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: a.id,
        action: AuditAction.CREATE,
        newValue: {
          supplierId: fields.supplierId,
          taskId: fields.taskId,
          status: fields.status,
          commissionType: commission.type,
          commissionValue: commission.value,
          paymentTerms: fields.paymentTerms
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${fields.supplierId}`);
    revalidatePath(`/permits/${task.permitId}/tasks`);
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה ביצירת הקצאה",
      ok: false
    };
  }
}

export async function updateSupplierAssignment(
  _prev: AssignmentFormState,
  formData: FormData
): Promise<AssignmentFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const id = String(formData.get("assignmentId") || "").trim();
    if (!id) return { error: "חסר מזהה הקצאה", ok: false };

    const existing = await prisma.supplierTaskAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        supplierId: true,
        taskId: true,
        status: true,
        amount: true,
        commissionType: true,
        commissionValue: true,
        paymentTerms: true,
        dueDate: true,
        notes: true,
        completedAt: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { error: "ההקצאה לא נמצאה", ok: false };

    const fields = readAssignmentForm(formData);
    const commission = parseCommission(formData);
    if (!commission.ok) return { error: commission.error, ok: false };

    // Status transitioned to COMPLETED → stamp completedAt (unless already
    // stamped). Going back from COMPLETED → keep the timestamp for history.
    const completedAt =
      fields.status === "COMPLETED" && !existing.completedAt
        ? new Date()
        : existing.completedAt;

    await prisma.$transaction(async (tx) => {
      await tx.supplierTaskAssignment.update({
        where: { id },
        data: {
          status: fields.status,
          amount: fields.amount ? new Prisma.Decimal(fields.amount) : null,
          commissionType: commission.type,
          commissionValue: commission.value
            ? new Prisma.Decimal(commission.value)
            : null,
          paymentTerms: fields.paymentTerms,
          dueDate: fields.dueDate,
          notes: fields.notes,
          completedAt
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: {
          status: existing.status,
          amount: existing.amount?.toString() ?? null,
          commissionType: existing.commissionType,
          commissionValue: existing.commissionValue?.toString() ?? null,
          paymentTerms: existing.paymentTerms,
          notes: existing.notes
        },
        newValue: {
          status: fields.status,
          amount: fields.amount,
          commissionType: commission.type,
          commissionValue: commission.value,
          paymentTerms: fields.paymentTerms,
          notes: fields.notes
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${existing.supplierId}`);
    revalidatePath(`/permits/${existing.task.permitId}/tasks`);
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה בעדכון הקצאה",
      ok: false
    };
  }
}

type DeleteResult = { ok: true } | { ok: false; error: string };

export async function deleteSupplierAssignment(
  assignmentId: string
): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const existing = await prisma.supplierTaskAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        supplierId: true,
        commissionPaidAt: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { ok: false, error: "ההקצאה לא נמצאה" };
    if (existing.commissionPaidAt) {
      // Assignments have no soft-delete column, so a hard delete here would
      // permanently erase the paid-commission record. Require unmarking the
      // payment first so there's a deliberate, audited step before the row
      // (and its commissionPaidAt evidence) disappears.
      return {
        ok: false,
        error: "לא ניתן למחוק הקצאה שהעמלה עליה כבר שולמה — יש לבטל את סימון התשלום קודם"
      };
    }

    await prisma.$transaction(async (tx) => {
      // Hard delete — assignments have no soft-delete column; audit captures
      // the disappearance.
      await tx.supplierTaskAssignment.delete({ where: { id: assignmentId } });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: assignmentId,
        action: AuditAction.DELETE,
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${existing.supplierId}`);
    revalidatePath(`/permits/${existing.task.permitId}/tasks`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת ההקצאה נכשלה"
    };
  }
}

// Block 38 — PM Lead Tracker dashboard. Inline status + notes update for
// a partner-lead assignment (the ones whose Task name starts with
// "ליד שותף"). Reuses the same revalidation surface as the heavier
// updateSupplierAssignment so the back-office views stay consistent.
//
// Kept narrow (only status + notes) on purpose — the full edit dialog
// remains the way to touch commission terms / due dates. The lead
// tracker is for triage, not contract editing.
export async function updateLeadStatusAndNotes(args: {
  assignmentId: string;
  status: SupplierAssignmentStatus;
  notes: string | null;
}): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    if (!VALID_STATUSES.includes(args.status)) {
      return { ok: false, error: "סטטוס לא חוקי" };
    }
    const existing = await prisma.supplierTaskAssignment.findUnique({
      where: { id: args.assignmentId },
      select: {
        id: true,
        supplierId: true,
        status: true,
        notes: true,
        completedAt: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { ok: false, error: "הליד לא נמצא" };

    const notes = args.notes?.trim() || null;
    const completedAt =
      args.status === "COMPLETED" && !existing.completedAt
        ? new Date()
        : existing.completedAt;

    await prisma.$transaction(async (tx) => {
      await tx.supplierTaskAssignment.update({
        where: { id: args.assignmentId },
        data: {
          status: args.status,
          notes,
          completedAt
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: args.assignmentId,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: existing.status, notes: existing.notes },
        newValue: {
          status: args.status,
          notes,
          source: "pm_lead_tracker"
        },
        userId: me.id
      });
    });

    revalidatePath("/leads");
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${existing.supplierId}`);
    revalidatePath(`/permits/${existing.task.permitId}/tasks`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "עדכון הליד נכשל"
    };
  }
}

// Toggle paid: clicking when already paid clears the stamp ("טעיתי, הם לא
// שילמו"). Both directions audit-logged.
export async function toggleAssignmentPaid(assignmentId: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const existing = await prisma.supplierTaskAssignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        supplierId: true,
        commissionPaidAt: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { ok: false, error: "ההקצאה לא נמצאה" };

    const nextPaidAt = existing.commissionPaidAt ? null : new Date();

    const toggled = await prisma.$transaction(async (tx) => {
      // Conditional update guarded on the value we just read — a concurrent
      // double-click/double-submit race will only let one request win the
      // flip, instead of both computing "not paid -> paid" and stomping
      // each other's audit trail.
      const { count } = await tx.supplierTaskAssignment.updateMany({
        where: { id: assignmentId, commissionPaidAt: existing.commissionPaidAt },
        data: { commissionPaidAt: nextPaidAt }
      });
      if (count === 0) return false;
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: assignmentId,
        action: AuditAction.STATUS_CHANGE,
        oldValue: {
          commissionPaidAt: existing.commissionPaidAt?.toISOString() ?? null
        },
        newValue: { commissionPaidAt: nextPaidAt?.toISOString() ?? null },
        userId: me.id
      });
      return true;
    });

    if (!toggled) {
      return { ok: false, error: "הנתון השתנה בינתיים, רענן ונסה שוב" };
    }

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${existing.supplierId}`);
    revalidatePath(`/permits/${existing.task.permitId}/tasks`);
    revalidatePath("/finances/supplier-commissions");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "סימון התשלום נכשל"
    };
  }
}
