"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity } from "@/lib/audit";
import { assertPermitOpenForEdits } from "./permits";

// Bulk task operations (Block 20). Split out of app/actions/tasks.ts
// (June 2026) so the single-task action file stays focused on per-row
// semantics (cascades, validation per-field) and bulk gets its own
// optimized path (single updateMany + batched audit rows).
//
// All three actions follow the same shape:
//   1. Trim + de-dup the incoming taskId list.
//   2. Verify each parent permit is still editable (no completed locks).
//   3. Run a single updateMany / per-task transaction; audit logs are
//      emitted per affected task so the recycle-bin / audit log stays
//      useful.
//   4. Revalidate every touched permit + the global /tasks list.
// Structured ActionResult lets the floating bar surface errors inline
// instead of crashing the boundary.

// Duplicated from tasks.ts on purpose — these two enums are too small to
// justify a shared lib file, and keeping them local means each "use server"
// file can be reviewed in isolation. If the underlying Prisma enum gains a
// new value, both files need updating; the audit log surfaces missed
// updates immediately ("invalid status" errors).
const VALID_TASK_STATUSES = new Set<TaskStatus>([
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
]);

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
