"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MilestoneStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { parseAmount, parseDate } from "@/lib/validators/form";
import { assertPermitOpenForEdits } from "./permits";

// Type is internal — "use server" files can only export async functions.
type MilestoneFormState = { error: string | null; ok: boolean };

// Trigger mode is the XOR: a milestone fires either when its anchor task is
// completed (legacy/explicit) or when the permit's overall task-completion
// crosses a percentage threshold. Exactly one of the two must be set.
type TriggerMode =
  | { kind: "task"; triggerTaskId: string; triggerPercentage: null }
  | { kind: "percentage"; triggerTaskId: null; triggerPercentage: number };

function parseTrigger(formData: FormData): TriggerMode | { error: string } {
  const triggerKind = String(formData.get("triggerKind") || "").trim();
  if (triggerKind === "percentage") {
    const raw = String(formData.get("triggerPercentage") || "").trim();
    if (!raw) return { error: "יש להזין אחוז יעד" };
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 100) {
      return { error: "האחוז חייב להיות שלם בטווח 1–100" };
    }
    return { kind: "percentage", triggerTaskId: null, triggerPercentage: n };
  }
  // Default: legacy task-based trigger.
  const taskId = String(formData.get("triggerTaskId") || "").trim();
  if (!taskId) return { error: "יש לבחור משימה מפעילה" };
  return { kind: "task", triggerTaskId: taskId, triggerPercentage: null };
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
      const dueDate = parseDate(formData.get("dueDate"));
      const notes = String(formData.get("notes") || "").trim() || null;
      const triggerResult = parseTrigger(formData);
      if ("error" in triggerResult) return { error: triggerResult.error, ok: false };

      if (!permitId) return { error: "חסר מזהה היתר", ok: false };
      if (!name) return { error: "שם אבן הדרך חובה", ok: false };
      if (amount === null) return { error: "סכום לא חוקי", ok: false };

      try {
        await assertPermitOpenForEdits(permitId);
      } catch (e) {
        return { error: e instanceof Error ? e.message : "ההיתר נעול", ok: false };
      }

      // Percentage-based milestones start PENDING and only flip to DUE when
      // the live completion rate crosses the threshold (computed on every
      // permit page load — see finances-tab.tsx). Task-based milestones keep
      // the original semantics: born DUE if the anchor task is already done.
      let initialStatus: MilestoneStatus = MilestoneStatus.PENDING;
      let initialTriggeredAt: Date | null = null;

      if (triggerResult.kind === "task") {
        const task = await prisma.task.findFirst({
          where: { id: triggerResult.triggerTaskId, deletedAt: null },
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
        if (task.status === "COMPLETED") {
          initialStatus = MilestoneStatus.DUE;
          initialTriggeredAt = new Date();
        }
      } else if (triggerResult.kind === "percentage") {
        // Born DUE if the permit's current completion already meets the target.
        const [completedCount, totalCount] = await Promise.all([
          prisma.task.count({
            where: { permitId, deletedAt: null, status: "COMPLETED" }
          }),
          prisma.task.count({ where: { permitId, deletedAt: null } })
        ]);
        const currentPct =
          totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
        if (currentPct >= triggerResult.triggerPercentage) {
          initialStatus = MilestoneStatus.DUE;
          initialTriggeredAt = new Date();
        }
      }

      await prisma.$transaction(async (tx) => {
        const milestone = await tx.billingMilestone.create({
          data: {
            permitId,
            triggerTaskId: triggerResult.triggerTaskId,
            triggerPercentage: triggerResult.triggerPercentage,
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
            triggerKind: triggerResult.kind,
            triggerTaskId: triggerResult.triggerTaskId,
            triggerPercentage: triggerResult.triggerPercentage,
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
      const dueDate = parseDate(formData.get("dueDate"));
      const notes = String(formData.get("notes") || "").trim() || null;
      const triggerResult = parseTrigger(formData);
      if ("error" in triggerResult) return { error: triggerResult.error, ok: false };

      if (!milestoneId) return { error: "חסר מזהה אבן דרך", ok: false };
      if (!name) return { error: "שם אבן הדרך חובה", ok: false };
      if (amount === null) return { error: "סכום לא חוקי", ok: false };

      const existing = await prisma.billingMilestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          permitId: true,
          name: true,
          amount: true,
          triggerTaskId: true,
          triggerPercentage: true,
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

      // If switching to (or staying on) a task trigger that differs from the
      // current anchor, validate the new task belongs to the same permit and
      // isn't already attached to a different milestone.
      if (
        triggerResult.kind === "task" &&
        triggerResult.triggerTaskId !== existing.triggerTaskId
      ) {
        const task = await prisma.task.findFirst({
          where: { id: triggerResult.triggerTaskId, deletedAt: null },
          select: {
            id: true,
            permitId: true,
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
        triggerPercentage: existing.triggerPercentage,
        dueDate: existing.dueDate?.toISOString() ?? null,
        notes: existing.notes
      };
      const newValue = {
        name,
        amount,
        triggerTaskId: triggerResult.triggerTaskId,
        triggerPercentage: triggerResult.triggerPercentage,
        dueDate: dueDate?.toISOString() ?? null,
        notes
      };

      await prisma.$transaction(async (tx) => {
        await tx.billingMilestone.update({
          where: { id: milestoneId },
          data: {
            name,
            amount,
            triggerTaskId: triggerResult.triggerTaskId,
            triggerPercentage: triggerResult.triggerPercentage,
            dueDate,
            notes
          }
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
