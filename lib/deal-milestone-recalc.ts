import { AuditAction, MilestoneStatus, Prisma } from "@prisma/client";
import { AuditEntity, logAudit } from "@/lib/audit";

/**
 * Recompute deal-level progress and auto-flip DealMilestone status based on
 * the percentage of completed tasks across ALL permits of the deal.
 *
 * MUST be called inside an existing prisma.$transaction. Called by
 * updateTaskStatus after the matching per-permit recalcPermitProgress runs,
 * so a single task completion can cascade through:
 *   task COMPLETED → permit progress % → BillingMilestone (permit-level)
 *                                     → DealMilestone (deal-level)
 *
 * Rules (mirrors recalcPermitProgress at the deal level):
 *  - PENDING DealMilestone → DUE once deal completion ≥ its triggerPercentage
 *  - DUE DealMilestone → PENDING if completion drops back below it (admin
 *    can still override manually). PAID milestones are never auto-touched.
 *  - DealMilestones without triggerPercentage are skipped — those are
 *    pure date-driven and don't have a "ready to bill" computed signal.
 *
 * Returns the freshly computed deal percentage for callers that want to
 * surface it. Returns null if the permit isn't attached to a deal (every
 * permit should be, but be defensive — orphan permits in dev data exist).
 */
export async function recalcDealMilestones(
  tx: Prisma.TransactionClient,
  permitId: string,
  userId: string | null
): Promise<number | null> {
  // Resolve the deal this permit belongs to. One small lookup since
  // updateTaskStatus already has the permitId in hand.
  const permit = await tx.permit.findUnique({
    where: { id: permitId },
    select: { masterDealId: true }
  });
  if (!permit) return null;
  const masterDealId = permit.masterDealId;

  // Are there any percentage-triggered milestones on the deal? If not we
  // skip the aggregation query entirely — the common case (no proposal-
  // converted deal, or deal whose milestones are all date-driven).
  const pctMilestones = await tx.dealMilestone.findMany({
    where: { masterDealId, triggerPercentage: { not: null } },
    select: { id: true, status: true, triggerPercentage: true, description: true }
  });
  if (pctMilestones.length === 0) return null;

  // Count completed + total tasks across ALL permits of this deal. The
  // proposal milestone's triggerPercentage was authored as a deal-level
  // intent ("pay me at 50% project completion"), so aggregating across
  // permits matches the customer-facing intent.
  const [completed, total] = await Promise.all([
    tx.task.count({
      where: {
        permit: { masterDealId, deletedAt: null },
        deletedAt: null,
        status: "COMPLETED"
      }
    }),
    tx.task.count({
      where: {
        permit: { masterDealId, deletedAt: null },
        deletedAt: null
      }
    })
  ]);
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const now = new Date();
  for (const m of pctMilestones) {
    if (m.triggerPercentage === null) continue;
    if (m.status === MilestoneStatus.PAID) continue; // never auto-revert paid milestones

    const shouldBeDue = pct >= m.triggerPercentage;

    if (shouldBeDue && m.status === MilestoneStatus.PENDING) {
      await tx.dealMilestone.update({
        where: { id: m.id },
        data: { status: MilestoneStatus.DUE }
      });
      await logAudit(tx, {
        entityType: AuditEntity.DEAL_MILESTONE,
        entityId: m.id,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: MilestoneStatus.PENDING },
        newValue: {
          status: MilestoneStatus.DUE,
          description: m.description,
          triggerPercentage: m.triggerPercentage,
          dealPct: pct,
          event: "auto_advanced_on_progress"
        },
        userId
      });
    } else if (!shouldBeDue && m.status === MilestoneStatus.DUE) {
      await tx.dealMilestone.update({
        where: { id: m.id },
        data: { status: MilestoneStatus.PENDING }
      });
      await logAudit(tx, {
        entityType: AuditEntity.DEAL_MILESTONE,
        entityId: m.id,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: MilestoneStatus.DUE },
        newValue: {
          status: MilestoneStatus.PENDING,
          description: m.description,
          triggerPercentage: m.triggerPercentage,
          dealPct: pct,
          event: "auto_reverted_on_regression"
        },
        userId
      });
    }
  }

  return pct;
}
