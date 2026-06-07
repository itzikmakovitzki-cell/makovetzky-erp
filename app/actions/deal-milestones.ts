"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MilestoneStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// DealMilestone status transitions. DealMilestones are deal-level payment
// milestones materialized from a converted Proposal (see
// proposals-convert.ts). Schema gives them MilestoneStatus PENDING / DUE /
// PAID and an optional triggerPercentage for the live progress bar, but
// until this file existed no code anywhere flipped their status — the
// "שולמה" label on the deal page never moved off PENDING.
//
// Audit flagged this gap alongside the MasterDeal/Proposal ones (June
// 2026). Same shape as updateMasterDealStatus: permissive admin-only
// action with optimistic-concurrency guard, full STATUS_CHANGE audit row,
// revalidates the deal page so the finances drawer refreshes.

const VALID_MILESTONE_STATUSES: MilestoneStatus[] = ["PENDING", "DUE", "PAID"];

export async function updateDealMilestoneStatus(
  milestoneId: string,
  newStatus: MilestoneStatus,
  expectedCurrentStatus: MilestoneStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  let me;
  try {
    me = await requireRole(["ADMIN"]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "אין הרשאה" };
  }

  if (!VALID_MILESTONE_STATUSES.includes(newStatus)) {
    return { ok: false, error: "סטטוס לא חוקי" };
  }

  const milestone = await prisma.dealMilestone.findUnique({
    where: { id: milestoneId },
    select: {
      id: true,
      masterDealId: true,
      description: true,
      status: true,
      amount: true
    }
  });
  if (!milestone) return { ok: false, error: "אבן הדרך לא נמצאה" };

  if (milestone.status !== expectedCurrentStatus) {
    return {
      ok: false,
      error: "הסטטוס השתנה ברקע (אולי בלשונית אחרת). רענן ונסה שוב."
    };
  }

  if (milestone.status === newStatus) {
    return { ok: true }; // no-op
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.dealMilestone.update({
      where: { id: milestoneId },
      data: {
        status: newStatus,
        // Stamp paidAt on transition INTO PAID; clear it on transition OUT
        // (so the audit log still has the prior value).
        paidAt:
          newStatus === MilestoneStatus.PAID
            ? now
            : milestone.status === MilestoneStatus.PAID
              ? null
              : undefined
      }
    });
    await logAudit(tx, {
      entityType: AuditEntity.DEAL_MILESTONE,
      entityId: milestoneId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: milestone.status },
      newValue: {
        status: newStatus,
        description: milestone.description,
        amount: Number(milestone.amount),
        ...(newStatus === MilestoneStatus.PAID
          ? { paidAt: now.toISOString() }
          : {})
      },
      userId: me.id
    });
  });

  revalidatePath(`/projects/${milestone.masterDealId}`);
  revalidatePath("/projects");
  revalidatePath("/calendar");

  return { ok: true };
}
