"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MasterDealStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// MasterDeal status transitions. The schema enum has four states
// (ACTIVE / ON_HOLD / COMPLETED / CANCELLED) but until this file existed,
// no action anywhere in the codebase ever changed MasterDeal.status —
// every deal was born ACTIVE and stayed there forever, so the status
// field was effectively decorative. Audit (June 2026) flagged this gap.
//
// Policy here is deliberately permissive: admin sees ALL four statuses
// in the dropdown and the action accepts any transition. We're not
// trying to enforce a strict workflow at the DB layer — the admin is the
// source of truth for "where is this project right now". What we DO
// enforce:
//   - ADMIN-only (mirrors markPermitCompleted / reopenPermit gating)
//   - The caller's view of the current status must match reality
//     (anti-stale optimistic check — if two tabs race, the loser errors
//     out instead of silently flipping the status back)
//   - Idempotent no-op when newStatus === currentStatus
//   - Full STATUS_CHANGE audit row on every real change

const VALID_DEAL_STATUSES: MasterDealStatus[] = [
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED"
];

export async function updateMasterDealStatus(
  dealId: string,
  newStatus: MasterDealStatus,
  expectedCurrentStatus: MasterDealStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  let me;
  try {
    me = await requireRole(["ADMIN"]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "אין הרשאה" };
  }

  if (!VALID_DEAL_STATUSES.includes(newStatus)) {
    return { ok: false, error: "סטטוס לא חוקי" };
  }

  const deal = await prisma.masterDeal.findFirst({
    where: { id: dealId, deletedAt: null },
    select: { id: true, name: true, status: true }
  });
  if (!deal) return { ok: false, error: "הפרוייקט לא נמצא" };

  if (deal.status !== expectedCurrentStatus) {
    return {
      ok: false,
      error:
        "סטטוס הפרוייקט השתנה ברקע (אולי בלשונית אחרת). רענן ונסה שוב."
    };
  }

  if (deal.status === newStatus) {
    return { ok: true }; // no-op — preserves audit log signal/noise
  }

  await prisma.$transaction(async (tx) => {
    await tx.masterDeal.update({
      where: { id: dealId },
      data: { status: newStatus }
    });
    await logAudit(tx, {
      entityType: AuditEntity.MASTER_DEAL,
      entityId: dealId,
      action: AuditAction.STATUS_CHANGE,
      oldValue: { status: deal.status },
      newValue: { status: newStatus, name: deal.name },
      userId: me.id
    });
  });

  revalidatePath(`/projects/${dealId}`);
  revalidatePath("/projects");
  revalidatePath("/");

  return { ok: true };
}
