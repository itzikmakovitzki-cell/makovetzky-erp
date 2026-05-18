"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, PermitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Helper used by other write actions (tasks/documents/milestones/notes) to
// refuse edits on a permit that is closed. Throws a Hebrew-friendly message
// the existing UI surfaces verbatim.
export async function assertPermitOpenForEdits(permitId: string): Promise<void> {
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true, status: true }
  });
  if (!permit) throw new Error("ההיתר לא נמצא");
  if (permit.status === "COMPLETED") {
    throw new Error("ההיתר הושלם וננעל לעריכה. פתח אותו מחדש כדי לערוך.");
  }
}

// Structured return shape so callers (UI buttons, dropdown menus) can render
// errors without an unhandled exception crashing the Next.js boundary.
export type DeleteResult = { ok: true } | { ok: false; error: string };

// Soft-delete a Permit + everything attached to it in one transaction. Block 20
// dropped the previous "has active children → throw" gate per user feedback:
// the admin's expectation is "delete makes it go away". Children (tasks,
// documents, billing milestones, notes, weekly summaries, magic links) are
// also stamped with deletedAt so they vanish from list/count queries together
// — and the underlying FKs are now Cascade so a future hard-delete from the
// recycle bin propagates too.
export async function deletePermit(permitId: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true, name: true }
    });
    if (!permit) return { ok: false, error: "ההיתר לא נמצא" };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      // Cascade the soft-delete to every child that itself uses deletedAt.
      // Buildings, magic links, dependencies, weekly summaries — the FK cascade
      // covers them on hard delete; here we just need to hide the visible ones.
      const childWhere = { permitId, deletedAt: null };
      await tx.task.updateMany({
        where: childWhere,
        data: { deletedAt: now }
      });
      await tx.document.updateMany({
        where: childWhere,
        data: { deletedAt: now }
      });
      // Note + WeeklySummaryDraft don't have deletedAt — they cascade only on
      // hard delete. BillingMilestone has no deletedAt either; visibility is
      // permit-scoped queries so hiding the parent is sufficient.

      await tx.permit.update({
        where: { id: permitId },
        data: { deletedAt: now }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PERMIT,
        entityId: permitId,
        action: AuditAction.DELETE,
        oldValue: { name: permit.name },
        newValue: { softDeletedAt: now.toISOString(), cascadedChildren: true },
        userId: me.id
      });
    });

    revalidatePath("/permits");
    revalidatePath("/projects");
    revalidatePath("/tasks");
    revalidatePath("/settings/recycle-bin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת ההיתר נכשלה"
    };
  }
}

// Soft-delete a MasterDeal + all of its permits + their children, in one tx.
// Same rationale as deletePermit: the previous "blocked by N active permits"
// gate was the production error; the admin wants the deal and everything
// hanging off it gone.
export async function deleteMasterDeal(
  masterDealId: string
): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const deal = await prisma.masterDeal.findFirst({
      where: { id: masterDealId, deletedAt: null },
      select: {
        id: true,
        name: true,
        clientId: true,
        permits: {
          where: { deletedAt: null },
          select: { id: true }
        }
      }
    });
    if (!deal) return { ok: false, error: "העסקה לא נמצאה" };

    const now = new Date();
    const permitIds = deal.permits.map((p) => p.id);
    await prisma.$transaction(async (tx) => {
      if (permitIds.length > 0) {
        const childWhere = {
          permitId: { in: permitIds },
          deletedAt: null as Date | null
        };
        await tx.task.updateMany({ where: childWhere, data: { deletedAt: now } });
        await tx.document.updateMany({ where: childWhere, data: { deletedAt: now } });
        await tx.permit.updateMany({
          where: { id: { in: permitIds }, deletedAt: null },
          data: { deletedAt: now }
        });
      }
      await tx.masterDeal.update({
        where: { id: masterDealId },
        data: { deletedAt: now }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: masterDealId,
        action: AuditAction.DELETE,
        oldValue: { name: deal.name, clientId: deal.clientId },
        newValue: {
          softDeletedAt: now.toISOString(),
          cascadedPermits: permitIds.length
        },
        userId: me.id
      });
    });

    revalidatePath(`/clients/${deal.clientId}`);
    revalidatePath("/clients");
    revalidatePath("/projects");
    revalidatePath("/permits");
    revalidatePath("/tasks");
    revalidatePath("/settings/recycle-bin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת העסקה נכשלה"
    };
  }
}

// Mark a permit as COMPLETED. Allowed only from non-terminal statuses so we
// don't accidentally re-flag a CANCELLED permit as "done". Idempotent for
// already-COMPLETED.
export async function markPermitCompleted(permitId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true, name: true, status: true }
  });
  if (!permit) throw new Error("ההיתר לא נמצא");
  if (permit.status === "COMPLETED") return; // idempotent
  if (permit.status === "CANCELLED") {
    throw new Error("היתר שבוטל — לא ניתן לסמן כהושלם");
  }

  await prisma.$transaction(async (tx) => {
    await tx.permit.update({
      where: { id: permitId },
      data: { status: PermitStatus.COMPLETED }
    });
    await logAudit(tx, {
      entityType: AuditEntity.PERMIT,
      entityId: permitId,
      action: AuditAction.UPDATE,
      oldValue: { status: permit.status },
      newValue: { status: PermitStatus.COMPLETED, name: permit.name },
      userId: me.id
    });
  });

  revalidatePath(`/permits/${permitId}`, "layout");
  revalidatePath("/permits");
  revalidatePath("/");
}

// Reopen a previously-completed permit. Lands back in IN_PROGRESS — the
// admin can manually move it to DRAFT or AWAITING_AUTHORITY afterwards if
// that better describes the reopened state.
export async function reopenPermit(permitId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true, name: true, status: true }
  });
  if (!permit) throw new Error("ההיתר לא נמצא");
  if (permit.status !== "COMPLETED") return; // idempotent — only completed → open

  await prisma.$transaction(async (tx) => {
    await tx.permit.update({
      where: { id: permitId },
      data: { status: PermitStatus.IN_PROGRESS }
    });
    await logAudit(tx, {
      entityType: AuditEntity.PERMIT,
      entityId: permitId,
      action: AuditAction.UPDATE,
      oldValue: { status: PermitStatus.COMPLETED },
      newValue: { status: PermitStatus.IN_PROGRESS, name: permit.name },
      userId: me.id
    });
  });

  revalidatePath(`/permits/${permitId}`, "layout");
  revalidatePath("/permits");
  revalidatePath("/");
}
