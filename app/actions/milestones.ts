"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MilestoneStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { assertPermitOpenForEdits } from "./permits";

// Type is internal — "use server" files can only export async functions.
type MilestoneFormState = { error: string | null; ok: boolean };

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const n = Number(str.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100; // normalize to 2 decimals
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export async function submitMilestone(
  _prev: MilestoneFormState,
  formData: FormData
): Promise<MilestoneFormState> {
  // Financial mutation — admins only. Defense in depth on top of the UI gate.
  let user;
  try {
    user = await requireRole(["ADMIN"]);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "אין הרשאה לפעולה זו",
      ok: false
    };
  }
  const kind = String(formData.get("kind") || "");

  try {
    if (kind === "create") {
      const permitId = String(formData.get("permitId") || "");
      const name = String(formData.get("name") || "").trim();
      const amount = parseAmount(formData.get("amount"));
      const triggerTaskId = String(formData.get("triggerTaskId") || "");
      const dueDate = parseDate(formData.get("dueDate"));
      const notes = String(formData.get("notes") || "").trim() || null;

      if (!permitId) return { error: "חסר מזהה היתר", ok: false };
      if (!name) return { error: "שם אבן הדרך חובה", ok: false };
      if (amount === null) return { error: "סכום לא חוקי", ok: false };
      if (!triggerTaskId) return { error: "יש לבחור משימה מפעילה", ok: false };

      const task = await prisma.task.findFirst({
        where: { id: triggerTaskId, deletedAt: null },
        select: {
          id: true,
          permitId: true,
          status: true,
          milestone: { select: { id: true } }
        }
      });
      if (!task || task.permitId !== permitId) {
        return { error: "המשימה אינה שייכת להיתר", ok: false };
      }
      if (task.milestone) {
        return { error: "למשימה זו כבר משויכת אבן דרך אחרת", ok: false };
      }
      try {
        await assertPermitOpenForEdits(permitId);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "ההיתר נעול", ok: false };
      }

      // If the trigger task is already COMPLETED, the milestone is born DUE.
      const initialStatus =
        task.status === "COMPLETED" ? MilestoneStatus.DUE : MilestoneStatus.PENDING;
      const initialTriggeredAt = initialStatus === MilestoneStatus.DUE ? new Date() : null;

      await prisma.$transaction(async (tx) => {
        const milestone = await tx.billingMilestone.create({
          data: {
            permitId,
            triggerTaskId,
            name,
            amount,
            status: initialStatus,
            dueDate,
            triggeredAt: initialTriggeredAt,
            notes
          }
        });
        await logAudit(tx, {
          entityType: AuditEntity.MILESTONE,
          entityId: milestone.id,
          action: AuditAction.CREATE,
          newValue: {
            permitId,
            name,
            amount,
            triggerTaskId,
            triggerTaskName: undefined, // filled below for context
            dueDate: dueDate?.toISOString() ?? null,
            status: initialStatus
          },
          userId: user.id
        });
      });

      revalidatePath(`/permits/${permitId}`, "layout");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const milestoneId = String(formData.get("milestoneId") || "");
      const name = String(formData.get("name") || "").trim();
      const amount = parseAmount(formData.get("amount"));
      const triggerTaskId = String(formData.get("triggerTaskId") || "");
      const dueDate = parseDate(formData.get("dueDate"));
      const notes = String(formData.get("notes") || "").trim() || null;

      if (!milestoneId) return { error: "חסר מזהה אבן דרך", ok: false };
      if (!name) return { error: "שם אבן הדרך חובה", ok: false };
      if (amount === null) return { error: "סכום לא חוקי", ok: false };
      if (!triggerTaskId) return { error: "יש לבחור משימה מפעילה", ok: false };

      const existing = await prisma.billingMilestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          permitId: true,
          name: true,
          amount: true,
          triggerTaskId: true,
          dueDate: true,
          notes: true,
          status: true
        }
      });
      if (!existing) return { error: "אבן הדרך לא נמצאה", ok: false };
      try {
        await assertPermitOpenForEdits(existing.permitId);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "ההיתר נעול", ok: false };
      }

      if (triggerTaskId !== existing.triggerTaskId) {
        const task = await prisma.task.findFirst({
          where: { id: triggerTaskId, deletedAt: null },
          select: {
            id: true,
            permitId: true,
            status: true,
            milestone: { select: { id: true } }
          }
        });
        if (!task || task.permitId !== existing.permitId) {
          return { error: "המשימה אינה שייכת להיתר", ok: false };
        }
        if (task.milestone && task.milestone.id !== existing.id) {
          return { error: "למשימה זו כבר משויכת אבן דרך אחרת", ok: false };
        }
      }

      const oldValue = {
        name: existing.name,
        amount: Number(existing.amount.toString()),
        triggerTaskId: existing.triggerTaskId,
        dueDate: existing.dueDate?.toISOString() ?? null,
        notes: existing.notes
      };
      const newValue = {
        name,
        amount,
        triggerTaskId,
        dueDate: dueDate?.toISOString() ?? null,
        notes
      };

      await prisma.$transaction(async (tx) => {
        await tx.billingMilestone.update({
          where: { id: milestoneId },
          data: { name, amount, triggerTaskId, dueDate, notes }
        });
        await logAudit(tx, {
          entityType: AuditEntity.MILESTONE,
          entityId: milestoneId,
          action: AuditAction.UPDATE,
          oldValue,
          newValue,
          userId: user.id
        });
      });

      revalidatePath(`/permits/${existing.permitId}`, "layout");
      return { error: null, ok: true };
    }

    return { error: "פעולה לא חוקית", ok: false };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה לא צפויה",
      ok: false
    };
  }
}

export async function markMilestonePaid(milestoneId: string): Promise<void> {
  // Financial mutation — admins only. Throws (not returns) so the client's
  // useTransition can surface the error via window.alert if a non-admin
  // somehow probes this directly.
  const user = await requireRole(["ADMIN"]);
  const milestone = await prisma.billingMilestone.findUnique({
    where: { id: milestoneId },
    select: { id: true, permitId: true, status: true, name: true, amount: true }
  });
  if (!milestone) throw new Error("אבן הדרך לא נמצאה");
  await assertPermitOpenForEdits(milestone.permitId);
  if (milestone.status === "PAID") return; // idempotent

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.billingMilestone.update({
      where: { id: milestoneId },
      data: { status: MilestoneStatus.PAID, paidAt: now }
    });
    await logAudit(tx, {
      entityType: AuditEntity.MILESTONE,
      entityId: milestoneId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: milestone.status },
      newValue: {
        status: MilestoneStatus.PAID,
        paidAt: now.toISOString(),
        amount: Number(milestone.amount.toString())
      },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${milestone.permitId}`, "layout");
}
