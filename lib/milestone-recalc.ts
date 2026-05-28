import { AuditAction, MilestoneStatus, Prisma } from "@prisma/client";
import { AuditEntity, logAudit } from "@/lib/audit";

/**
 * Recompute a permit's overall task-completion percentage and keep
 * percentage-triggered billing milestones in sync in real time.
 *
 * MUST be called inside an existing prisma.$transaction so the milestone flips
 * and their audit rows commit atomically with the task mutation that triggered
 * them. Block 19 introduced percentage milestones that were only evaluated at
 * creation time + live on the finances tab; Block 22 makes the DB the source of
 * truth so the Kanban board and inbox reflect 70%/80% triggers instantly.
 *
 * Rules:
 *  - progressPercent on the permit is always refreshed.
 *  - PENDING percentage-milestone → DUE once completion ≥ its threshold.
 *  - DUE percentage-milestone → PENDING if completion drops back below it
 *    (e.g. a task is un-completed). PAID milestones are never auto-touched.
 *  - Task-anchored (triggerTaskId) milestones are handled by updateTaskStatus
 *    itself and intentionally ignored here.
 *
 * Returns the freshly computed percentage for callers that want to surface it.
 */
export async function recalcPermitProgress(
  tx: Prisma.TransactionClient,
  permitId: string,
  userId: string | null
): Promise<number> {
  const [completed, total] = await Promise.all([
    tx.task.count({
      where: { permitId, deletedAt: null, status: "COMPLETED" }
    }),
    tx.task.count({ where: { permitId, deletedAt: null } })
  ]);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Keep the denormalized progress column fresh for list views and the Gantt.
  await tx.permit.update({
    where: { id: permitId },
    data: { progressPercent: pct }
  });

  const pctMilestones = await tx.billingMilestone.findMany({
    where: { permitId, triggerPercentage: { not: null } },
    select: { id: true, status: true, triggerPercentage: true }
  });

  const now = new Date();
  for (const m of pctMilestones) {
    if (m.triggerPercentage === null) continue;
    if (m.status === MilestoneStatus.PAID) continue; // never auto-revert billed work

    const shouldBeDue = pct >= m.triggerPercentage;

    if (shouldBeDue && m.status === MilestoneStatus.PENDING) {
      await tx.billingMilestone.update({
        where: { id: m.id },
        data: { status: MilestoneStatus.DUE, triggeredAt: now }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MILESTONE,
        entityId: m.id,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: MilestoneStatus.PENDING },
        newValue: {
          status: MilestoneStatus.DUE,
          triggeredAt: now.toISOString(),
          triggerPercentage: m.triggerPercentage,
          permitPct: pct
        },
        userId
      });
    } else if (!shouldBeDue && m.status === MilestoneStatus.DUE) {
      await tx.billingMilestone.update({
        where: { id: m.id },
        data: { status: MilestoneStatus.PENDING, triggeredAt: null }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MILESTONE,
        entityId: m.id,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: MilestoneStatus.DUE },
        newValue: { status: MilestoneStatus.PENDING, permitPct: pct },
        userId
      });
    }
  }

  return pct;
}
