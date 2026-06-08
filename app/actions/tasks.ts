"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  MilestoneStatus,
  PermitStatus,
  Prisma,
  SupplierAssignmentStatus,
  TaskPriority,
  TaskResponsibility,
  TaskStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { recalcPermitProgress } from "@/lib/milestone-recalc";
import { recalcDealMilestones } from "@/lib/deal-milestone-recalc";
import { maybeDispatchForm4Upsell } from "@/lib/form4-upsell";
import { assertPermitOpenForEdits } from "./permits";

const VALID_TASK_STATUSES = new Set<TaskStatus>([
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
]);

const VALID_PRIORITIES = new Set<TaskPriority>(["NORMAL", "URGENT"]);
const VALID_RESPONSIBILITIES = new Set<TaskResponsibility>([
  "INTERNAL",
  "CLIENT",
  "CONTRACTOR",
  "AUTHORITY"
]);

function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const trimmed = String(t).trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  if (!VALID_TASK_STATUSES.has(newStatus)) {
    throw new Error(`Invalid task status: ${newStatus}`);
  }

  const user = await getCurrentUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      permitId: true,
      status: true,
      frozen: true,
      completedAt: true,
      startedAt: true
    }
  });
  if (!task) throw new Error("Task not found");
  if (task.status === newStatus) return; // no-op — preserves audit log signal/noise
  await assertPermitOpenForEdits(task.permitId);

  const now = new Date();
  const willBeFrozen = newStatus === "AWAITING_AUTHORITY";

  const updateData: Prisma.TaskUpdateInput = {
    status: newStatus,
    frozen: willBeFrozen
  };

  if (newStatus === "COMPLETED" && !task.completedAt) {
    updateData.completedAt = now;
  } else if (newStatus !== "COMPLETED" && task.completedAt) {
    updateData.completedAt = null;
  }

  if (task.status === "OPEN" && newStatus !== "OPEN" && !task.startedAt) {
    updateData.startedAt = now;
  }

  // Cascade: task completion may trigger a linked billing milestone PENDING → DUE,
  // and reversing completion reverts DUE → PENDING. Never touch PAID milestones.
  const cameToCompleted = newStatus === "COMPLETED" && task.status !== "COMPLETED";
  const leftCompleted = newStatus !== "COMPLETED" && task.status === "COMPLETED";
  // Cascade: supplier assignments attached to this task ride along with the
  // task's status — when a surveyor starts the field work and the PM marks
  // the task IN_PROGRESS, the assignment should reflect that too. Manual
  // overrides (CANCELLED, or assignments already past the new state) are
  // never touched. One-way forward: reverting the task does NOT revert
  // the assignment, same reasoning as the permit promotion above.
  const cameToInProgress = newStatus === "IN_PROGRESS" && task.status !== "IN_PROGRESS";

  // Auto-promote the parent permit from DRAFT → IN_PROGRESS the first time
  // anyone moves a task off the OPEN starting line. New permits are born
  // DRAFT (see createProject / addPermitToDeal) and there's no other code
  // path that advances them; without this, a permit with 44 tasks and
  // visible progress on the dashboard still reads "טיוטה" forever. This is
  // one-way — reverting all tasks to OPEN does NOT demote the permit back
  // to DRAFT, because "work happened here" is the signal we care about.
  const taskLeavingOpen = task.status === "OPEN" && newStatus !== "OPEN";

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: updateData });
    await logAudit(tx, {
      entityType: AuditEntity.TASK,
      entityId: taskId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: task.status, frozen: task.frozen },
      newValue: { status: newStatus, frozen: willBeFrozen },
      userId: user.id
    });

    if (taskLeavingOpen) {
      // Re-read inside the tx — the permit could be in any status, and we
      // only promote from DRAFT. assertPermitOpenForEdits above already
      // rejected COMPLETED/CANCELLED, so the realistic branches here are
      // DRAFT (promote) and IN_PROGRESS/AWAITING_AUTHORITY (no-op).
      const permit = await tx.permit.findUnique({
        where: { id: task.permitId },
        select: { status: true, name: true }
      });
      if (permit?.status === PermitStatus.DRAFT) {
        await tx.permit.update({
          where: { id: task.permitId },
          data: { status: PermitStatus.IN_PROGRESS }
        });
        await logAudit(tx, {
          entityType: AuditEntity.PERMIT,
          entityId: task.permitId,
          action: AuditAction.STATUS_CHANGE,
          oldValue: { status: PermitStatus.DRAFT },
          newValue: {
            status: PermitStatus.IN_PROGRESS,
            name: permit.name,
            event: "auto_promoted_on_first_task_progress",
            triggeredByTaskId: taskId
          },
          userId: user.id
        });
      }
    }

    if (cameToCompleted || leftCompleted) {
      const milestone = await tx.billingMilestone.findUnique({
        where: { triggerTaskId: taskId },
        select: { id: true, status: true }
      });
      if (milestone) {
        if (cameToCompleted && milestone.status === MilestoneStatus.PENDING) {
          await tx.billingMilestone.update({
            where: { id: milestone.id },
            data: { status: MilestoneStatus.DUE, triggeredAt: now }
          });
          await logAudit(tx, {
            entityType: AuditEntity.MILESTONE,
            entityId: milestone.id,
            action: AuditAction.STATUS_CHANGE,
            oldValue: { status: MilestoneStatus.PENDING },
            newValue: {
              status: MilestoneStatus.DUE,
              triggeredAt: now.toISOString(),
              triggeredByTaskId: taskId
            },
            userId: user.id
          });
        } else if (leftCompleted && milestone.status === MilestoneStatus.DUE) {
          await tx.billingMilestone.update({
            where: { id: milestone.id },
            data: { status: MilestoneStatus.PENDING, triggeredAt: null }
          });
          await logAudit(tx, {
            entityType: AuditEntity.MILESTONE,
            entityId: milestone.id,
            action: AuditAction.STATUS_CHANGE,
            oldValue: { status: MilestoneStatus.DUE },
            newValue: { status: MilestoneStatus.PENDING, triggeredAt: null },
            userId: user.id
          });
        }
      }
    }

    // Block 22: recompute permit completion % and sync percentage-triggered
    // billing milestones (70%/80%) whenever a task crosses the COMPLETED line.
    // June 2026: same trigger also cascades to deal-level milestones
    // (DealMilestone) — proposal-conversion milestones with triggerPercentage
    // get auto-flipped PENDING ↔ DUE based on overall deal progress.
    if (cameToCompleted || leftCompleted) {
      await recalcPermitProgress(tx, task.permitId, user.id);
      await recalcDealMilestones(tx, task.permitId, user.id);
    }

    // Cascade SupplierTaskAssignment.status alongside the task.
    //   task → IN_PROGRESS : OPEN assignments advance to IN_PROGRESS
    //   task → COMPLETED   : OPEN + IN_PROGRESS assignments advance to
    //                        COMPLETED and stamp completedAt
    // CANCELLED assignments and assignments already at-or-past the new
    // state are left alone. Each affected row gets its own STATUS_CHANGE
    // audit entry so the trail mirrors a manual change.
    if (cameToInProgress || cameToCompleted) {
      const advanceableStatuses: SupplierAssignmentStatus[] = cameToCompleted
        ? [SupplierAssignmentStatus.OPEN, SupplierAssignmentStatus.IN_PROGRESS]
        : [SupplierAssignmentStatus.OPEN];
      const targetStatus = cameToCompleted
        ? SupplierAssignmentStatus.COMPLETED
        : SupplierAssignmentStatus.IN_PROGRESS;

      const affected = await tx.supplierTaskAssignment.findMany({
        where: { taskId, status: { in: advanceableStatuses } },
        select: { id: true, status: true, supplierId: true }
      });
      for (const a of affected) {
        await tx.supplierTaskAssignment.update({
          where: { id: a.id },
          data: {
            status: targetStatus,
            ...(cameToCompleted ? { completedAt: now } : {})
          }
        });
        await logAudit(tx, {
          entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
          entityId: a.id,
          action: AuditAction.STATUS_CHANGE,
          oldValue: { status: a.status },
          newValue: {
            status: targetStatus,
            ...(cameToCompleted ? { completedAt: now.toISOString() } : {}),
            event: "auto_advanced_with_task",
            triggeredByTaskId: taskId,
            supplierId: a.supplierId
          },
          userId: user.id
        });
      }
    }
  });

  revalidatePath(`/permits/${task.permitId}`, "layout");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");

  // Block 38 — Smart milestone upsell. Fire the Form-4 home-entry upsell
  // AFTER the parent transaction commits so a Green API / Resend hiccup
  // can never roll back the user's task-status change. The helper itself
  // self-dedupes via the audit log and gates on Client.clientType ===
  // "PRIVATE", so calling it on every COMPLETED transition is safe.
  if (newStatus === "COMPLETED" && task.status !== "COMPLETED") {
    void maybeDispatchForm4Upsell(task.permitId, user.id);
  }
}

export async function toggleTaskSpotlight(taskId: string) {
  const user = await getCurrentUser();
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: { id: true, permitId: true, isSpotlight: true }
  });
  if (!task) throw new Error("Task not found");
  await assertPermitOpenForEdits(task.permitId);

  const newSpotlight = !task.isSpotlight;

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: { isSpotlight: newSpotlight }
    });
    await logAudit(tx, {
      entityType: AuditEntity.TASK,
      entityId: taskId,
      action: AuditAction.UPDATE,
      oldValue: { isSpotlight: task.isSpotlight },
      newValue: { isSpotlight: newSpotlight },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${task.permitId}`, "layout");
  revalidatePath("/tasks");
}

// Soft-delete: blocked if the task is the trigger of an unpaid milestone or
// still has active supplier assignments. Dependents that reference this task
// keep their TaskDependency rows — UI shows them as broken links until admin
// either restores or purges.
export async function deleteTask(taskId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      name: true,
      permitId: true,
      milestone: { select: { id: true, name: true, status: true } },
      _count: {
        select: {
          supplierAssignments: {
            where: { status: { in: ["OPEN", "IN_PROGRESS"] } }
          }
        }
      }
    }
  });
  if (!task) throw new Error("המשימה לא נמצאה");
  await assertPermitOpenForEdits(task.permitId);
  if (task.milestone && task.milestone.status !== "PAID") {
    throw new Error(
      `לא ניתן למחוק — המשימה מפעילה את אבן הדרך "${task.milestone.name}"`
    );
  }
  if (task._count.supplierAssignments > 0) {
    throw new Error(
      `לא ניתן למחוק — ${task._count.supplierAssignments} שיוכי ספק פתוחים על המשימה`
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { deletedAt: now } });
    await logAudit(tx, {
      entityType: AuditEntity.TASK,
      entityId: taskId,
      action: AuditAction.DELETE,
      oldValue: { name: task.name },
      newValue: { softDeletedAt: now.toISOString() },
      userId: me.id
    });
  });

  revalidatePath(`/permits/${task.permitId}`, "layout");
  revalidatePath("/tasks");
  revalidatePath("/settings/recycle-bin");
}

type TaskMetadataInput = {
  name?: string;
  description?: string | null;
  category?: string | null;
  responsibility?: TaskResponsibility | null;
  tags?: readonly string[];
  dueDate?: Date | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
};

type TaskMetadataResult = { ok: boolean; error: string | null };

// Generic field editor for a single task. Not for status/spotlight/delete —
// those have purpose-built actions that also do cascade work (milestones, etc.).
// Only writes keys actually provided; logs UPDATE audit with the diff.
export async function updateTaskMetadata(
  taskId: string,
  input: TaskMetadataInput
): Promise<TaskMetadataResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: {
        id: true,
        permitId: true,
        name: true,
        description: true,
        category: true,
        responsibility: true,
        tags: true,
        dueDate: true,
        priority: true,
        assigneeId: true
      }
    });
    if (!task) return { ok: false, error: "המשימה לא נמצאה" };
    await assertPermitOpenForEdits(task.permitId);

    const data: Prisma.TaskUpdateInput = {};
    // Loosely typed because Prisma.InputJsonValue rejects `null` even though
    // Postgres JSONB accepts it. We cast at the logAudit call below.
    const oldValue: Record<string, string | number | boolean | string[] | null> = {};
    const newValue: Record<string, string | number | boolean | string[] | null> = {};

    if (input.name !== undefined) {
      const next = String(input.name).trim();
      if (!next) return { ok: false, error: "שם המשימה חובה" };
      if (next !== task.name) {
        data.name = next;
        oldValue.name = task.name;
        newValue.name = next;
      }
    }

    if (input.description !== undefined) {
      const next =
        input.description === null ? null : String(input.description).trim() || null;
      if (next !== task.description) {
        data.description = next;
        oldValue.description = task.description;
        newValue.description = next;
      }
    }

    if (input.category !== undefined) {
      const next =
        input.category === null ? null : String(input.category).trim() || null;
      if (next !== task.category) {
        data.category = next;
        oldValue.category = task.category;
        newValue.category = next;
      }
    }

    if (input.responsibility !== undefined) {
      const next = input.responsibility;
      if (next !== null && !VALID_RESPONSIBILITIES.has(next)) {
        return { ok: false, error: "אחריות לא חוקית" };
      }
      if (next !== task.responsibility) {
        data.responsibility = next;
        oldValue.responsibility = task.responsibility;
        newValue.responsibility = next;
      }
    }

    if (input.tags !== undefined) {
      const next = normalizeTags(input.tags);
      const prev = task.tags;
      const changed =
        next.length !== prev.length || next.some((t, i) => t !== prev[i]);
      if (changed) {
        data.tags = next;
        oldValue.tags = prev;
        newValue.tags = next;
      }
    }

    if (input.dueDate !== undefined) {
      const prevIso = task.dueDate?.toISOString() ?? null;
      const nextIso = input.dueDate?.toISOString() ?? null;
      if (prevIso !== nextIso) {
        data.dueDate = input.dueDate;
        oldValue.dueDate = prevIso;
        newValue.dueDate = nextIso;
      }
    }

    if (input.priority !== undefined) {
      if (!VALID_PRIORITIES.has(input.priority)) {
        return { ok: false, error: "עדיפות לא חוקית" };
      }
      if (input.priority !== task.priority) {
        data.priority = input.priority;
        oldValue.priority = task.priority;
        newValue.priority = input.priority;
      }
    }

    if (input.assigneeId !== undefined) {
      const next = input.assigneeId;
      if (next !== task.assigneeId) {
        data.assignee =
          next === null ? { disconnect: true } : { connect: { id: next } };
        oldValue.assigneeId = task.assigneeId;
        newValue.assigneeId = next;
      }
    }

    if (Object.keys(newValue).length === 0) {
      return { ok: true, error: null };
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data });
      await logAudit(tx, {
        entityType: AuditEntity.TASK,
        entityId: taskId,
        action: AuditAction.UPDATE,
        oldValue: oldValue as Prisma.InputJsonValue,
        newValue: newValue as Prisma.InputJsonValue,
        userId: me.id
      });
    });

    revalidatePath(`/permits/${task.permitId}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ----------------------------------------------------------------------------
// Block 35: Manual single-task creation. Until now tasks only entered the
// system via template-driven permit creation (app/actions/projects.ts) or
// the xlsx bulk import — there was no way to add an ad-hoc task to an
// existing permit through the UI. This action mirrors updateTaskMetadata's
// validation but creates a row, audits it, and recalculates permit progress
// so the parent's % stays consistent.
// ----------------------------------------------------------------------------
export type CreateTaskInput = {
  permitId: string;
  name: string;
  description?: string | null;
  category?: string | null;
  responsibility?: TaskResponsibility | null;
  tags?: readonly string[];
  dueDate?: Date | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
};

export type CreateTaskResult =
  | { ok: true; taskId: string }
  | { ok: false; error: string };

export async function createTask(
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);

    const name = String(input.name ?? "").trim();
    if (!name) return { ok: false, error: "שם המשימה חובה" };
    if (name.length > 200) {
      return { ok: false, error: "שם המשימה ארוך מדי (מקסימום 200 תווים)" };
    }

    const permit = await prisma.permit.findFirst({
      where: { id: input.permitId, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!permit) return { ok: false, error: "ההיתר לא נמצא" };
    await assertPermitOpenForEdits(input.permitId);

    const responsibility = input.responsibility ?? null;
    if (responsibility !== null && !VALID_RESPONSIBILITIES.has(responsibility)) {
      return { ok: false, error: "אחריות לא חוקית" };
    }

    const priority: TaskPriority = input.priority ?? "NORMAL";
    if (!VALID_PRIORITIES.has(priority)) {
      return { ok: false, error: "עדיפות לא חוקית" };
    }

    const description =
      input.description == null ? null : String(input.description).trim() || null;
    const category =
      input.category == null ? null : String(input.category).trim() || null;
    const tags = normalizeTags(input.tags ?? []);
    const dueDate = input.dueDate ?? null;
    const assigneeId = input.assigneeId ?? null;

    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: {
          id: assigneeId,
          isActive: true,
          role: { in: ["ADMIN", "EMPLOYEE", "CONTRACTOR"] }
        },
        select: { id: true }
      });
      if (!assignee) return { ok: false, error: "האחראי שנבחר לא קיים" };
    }

    const created = await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          permitId: input.permitId,
          name,
          description,
          category,
          responsibility,
          tags,
          dueDate,
          priority,
          assigneeId
        },
        select: { id: true }
      });
      await logAudit(tx, {
        entityType: AuditEntity.TASK,
        entityId: t.id,
        action: AuditAction.CREATE,
        newValue: {
          permitId: input.permitId,
          name,
          description,
          category,
          responsibility,
          tags,
          dueDate: dueDate?.toISOString() ?? null,
          priority,
          assigneeId
        },
        userId: me.id
      });
      // New tasks land OPEN, so percentage-trigger milestones may flip
      // DUE → PENDING if the denominator grew enough. Recalc inside the
      // same tx so the milestone state and the task state commit together.
      await recalcPermitProgress(tx, input.permitId, me.id);
      return t;
    });

    revalidatePath(`/permits/${input.permitId}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    return { ok: true, taskId: created.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ----------------------------------------------------------------------------
// Block 25: Snooze. Pushes the due date forward by 1 or 7 days and increments
// snoozeCount so chronic slippage is visible. Base date is the later of "today"
// and the current due date, so snoozing an already-overdue task moves it
// forward from now rather than from a stale past date.
// ----------------------------------------------------------------------------
export type SnoozeResult = { ok: boolean; error: string | null };

const SNOOZE_DAYS = new Set([1, 7]);
const DAY_MS = 86_400_000;

export async function snoozeTask(taskId: string, days: number): Promise<SnoozeResult> {
  try {
    if (!SNOOZE_DAYS.has(days)) {
      return { ok: false, error: "טווח דחייה לא חוקי" };
    }
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const task = await prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      select: { id: true, permitId: true, dueDate: true, snoozeCount: true }
    });
    if (!task) return { ok: false, error: "המשימה לא נמצאה" };
    await assertPermitOpenForEdits(task.permitId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base =
      task.dueDate && task.dueDate.getTime() > today.getTime()
        ? new Date(task.dueDate)
        : today;
    base.setHours(0, 0, 0, 0);
    const newDue = new Date(base.getTime() + days * DAY_MS);
    const newCount = task.snoozeCount + 1;

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { dueDate: newDue, snoozeCount: { increment: 1 } }
      });
      await logAudit(tx, {
        entityType: AuditEntity.TASK,
        entityId: taskId,
        action: AuditAction.UPDATE,
        oldValue: {
          dueDate: task.dueDate?.toISOString() ?? null,
          snoozeCount: task.snoozeCount
        },
        newValue: {
          dueDate: newDue.toISOString(),
          snoozeCount: newCount,
          snoozedDays: days
        },
        userId: me.id
      });
    });

    revalidatePath(`/permits/${task.permitId}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "דחיית המשימה נכשלה"
    };
  }
}

export async function overrideTaskDependency(taskId: string, dependsOnTaskId: string) {
  const user = await getCurrentUser();
  const dep = await prisma.taskDependency.findUnique({
    where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
    include: {
      task: { select: { permitId: true } },
      dependsOn: { select: { id: true, name: true } }
    }
  });
  if (!dep) throw new Error("Dependency not found");
  if (dep.overriddenByAdmin) return; // idempotent — already overridden
  await assertPermitOpenForEdits(dep.task.permitId);

  await prisma.$transaction(async (tx) => {
    await tx.taskDependency.update({
      where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } },
      data: {
        overriddenByAdmin: true,
        overriddenAt: new Date(),
        overriddenById: user.id
      }
    });
    await logAudit(tx, {
      entityType: AuditEntity.TASK,
      entityId: taskId,
      action: AuditAction.DEPENDENCY_OVERRIDE,
      newValue: {
        overriddenDependsOnTaskId: dependsOnTaskId,
        overriddenDependsOnName: dep.dependsOn.name
      },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${dep.task.permitId}`, "layout");
  revalidatePath("/tasks");
}
