"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MilestoneStatus, Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

const VALID_TASK_STATUSES = new Set<TaskStatus>([
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
]);

export async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
  if (!VALID_TASK_STATUSES.has(newStatus)) {
    throw new Error(`Invalid task status: ${newStatus}`);
  }

  const user = await getCurrentUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
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
  });

  revalidatePath(`/permits/${task.permitId}`, "layout");
  revalidatePath("/tasks");
}

export async function toggleTaskSpotlight(taskId: string) {
  const user = await getCurrentUser();
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, permitId: true, isSpotlight: true }
  });
  if (!task) throw new Error("Task not found");

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
