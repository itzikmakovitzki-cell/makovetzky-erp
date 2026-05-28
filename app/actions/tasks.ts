"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  MilestoneStatus,
  Prisma,
  TaskPriority,
  TaskResponsibility,
  TaskStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { recalcPermitProgress } from "@/lib/milestone-recalc";
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
    if (cameToCompleted || leftCompleted) {
      await recalcPermitProgress(tx, task.permitId, user.id);
    }
  });

  revalidatePath(`/permits/${task.permitId}`, "layout");
  revalidatePath("/tasks");
  revalidatePath("/my-tasks");
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

// ============================================================================
// BULK OPERATIONS (Block 20)
// ----------------------------------------------------------------------------
// All three actions:
//   1. Trim + de-dup the incoming taskId list.
//   2. Verify each parent permit is still editable (no completed locks).
//   3. Run a single updateMany / per-task transaction; audit logs are emitted
//      per affected task so the recycle-bin / audit log stays useful.
//   4. Revalidate every touched permit + the global /tasks list.
// Structured ActionResult lets the floating bar surface errors inline
// instead of crashing the boundary.
// ============================================================================

export type BulkResult = {
  ok: boolean;
  error: string | null;
  affected: number;
};

function dedupeTaskIds(taskIds: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of taskIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

// Collect every distinct permit referenced by the selection and assert each
// is editable. Returns the list (or throws — caller wraps in try/catch and
// converts to BulkResult).
async function loadEditablePermitIds(taskIds: string[]): Promise<string[]> {
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds }, deletedAt: null },
    select: { permitId: true }
  });
  const permitIds = Array.from(new Set(tasks.map((t) => t.permitId)));
  await Promise.all(permitIds.map((p) => assertPermitOpenForEdits(p)));
  return permitIds;
}

export async function bulkUpdateTaskAssignee(
  taskIds: readonly string[],
  assigneeId: string | null
): Promise<BulkResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const ids = dedupeTaskIds(taskIds);
    if (ids.length === 0) {
      return { ok: false, error: "לא נבחרו משימות", affected: 0 };
    }
    // If a real assignee was supplied, make sure they exist and are still
    // active before we point a bunch of tasks at them.
    if (assigneeId) {
      const user = await prisma.user.findFirst({
        where: { id: assigneeId, isActive: true },
        select: { id: true, name: true, role: true }
      });
      if (!user) {
        return { ok: false, error: "המשתמש שנבחר לא קיים או לא פעיל", affected: 0 };
      }
    }
    const permitIds = await loadEditablePermitIds(ids);

    const result = await prisma.task.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { assigneeId }
    });
    await prisma.$transaction(
      ids.map((taskId) =>
        prisma.auditLog.create({
          data: {
            entityType: AuditEntity.TASK,
            entityId: taskId,
            action: AuditAction.ASSIGN,
            oldValue: Prisma.JsonNull,
            newValue: { assigneeId, bulk: true },
            userId: me.id
          }
        })
      )
    );

    for (const p of permitIds) revalidatePath(`/permits/${p}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    return { ok: true, error: null, affected: result.count };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "פעולה קבוצתית נכשלה",
      affected: 0
    };
  }
}

export async function bulkUpdateTaskStatus(
  taskIds: readonly string[],
  newStatus: TaskStatus
): Promise<BulkResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    if (!VALID_TASK_STATUSES.has(newStatus)) {
      return { ok: false, error: "סטטוס לא חוקי", affected: 0 };
    }
    const ids = dedupeTaskIds(taskIds);
    if (ids.length === 0) {
      return { ok: false, error: "לא נבחרו משימות", affected: 0 };
    }
    const permitIds = await loadEditablePermitIds(ids);

    // AWAITING_AUTHORITY uses the `frozen` flag and `startedAt`/`completedAt`
    // bookkeeping the single-task path handles. Bulk version keeps it simple:
    // just set the status. The `frozen` flag stays whatever it was — admin
    // can fine-tune individual rows afterwards if needed.
    const now = new Date();
    const data: Prisma.TaskUpdateManyMutationInput = { status: newStatus };
    if (newStatus === "COMPLETED") data.completedAt = now;
    else if (newStatus === "IN_PROGRESS") data.startedAt = now;
    else if (newStatus === "OPEN") {
      data.completedAt = null;
      data.startedAt = null;
    }

    const result = await prisma.task.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data
    });
    await prisma.$transaction(
      ids.map((taskId) =>
        prisma.auditLog.create({
          data: {
            entityType: AuditEntity.TASK,
            entityId: taskId,
            action: AuditAction.STATUS_CHANGE,
            oldValue: Prisma.JsonNull,
            newValue: { status: newStatus, bulk: true },
            userId: me.id
          }
        })
      )
    );

    for (const p of permitIds) revalidatePath(`/permits/${p}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    return { ok: true, error: null, affected: result.count };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "פעולה קבוצתית נכשלה",
      affected: 0
    };
  }
}

export async function bulkDeleteTasks(
  taskIds: readonly string[]
): Promise<BulkResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const ids = dedupeTaskIds(taskIds);
    if (ids.length === 0) {
      return { ok: false, error: "לא נבחרו משימות", affected: 0 };
    }
    // Block tasks anchoring an unpaid milestone — same defensive guard as
    // single-task deleteTask. Surfaces the count so the admin can either
    // un-select those rows or mark them paid first.
    const anchored = await prisma.task.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        milestone: { status: { not: "PAID" } }
      },
      select: { id: true, name: true }
    });
    if (anchored.length > 0) {
      const names = anchored
        .slice(0, 3)
        .map((t) => `"${t.name}"`)
        .join(", ");
      const extra = anchored.length > 3 ? ` ועוד ${anchored.length - 3}` : "";
      return {
        ok: false,
        error: `לא ניתן למחוק — ${anchored.length} משימות מפעילות אבני דרך שטרם שולמו: ${names}${extra}`,
        affected: 0
      };
    }

    const permitIds = await loadEditablePermitIds(ids);
    const now = new Date();

    const result = await prisma.task.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: now }
    });
    await prisma.$transaction(
      ids.map((taskId) =>
        prisma.auditLog.create({
          data: {
            entityType: AuditEntity.TASK,
            entityId: taskId,
            action: AuditAction.DELETE,
            oldValue: Prisma.JsonNull,
            newValue: { softDeletedAt: now.toISOString(), bulk: true },
            userId: me.id
          }
        })
      )
    );

    for (const p of permitIds) revalidatePath(`/permits/${p}`, "layout");
    revalidatePath("/tasks");
    revalidatePath("/my-tasks");
    revalidatePath("/settings/recycle-bin");
    return { ok: true, error: null, affected: result.count };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקה קבוצתית נכשלה",
      affected: 0
    };
  }
}
