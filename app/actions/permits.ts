"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Soft-delete a Permit. Blocked if any of its direct children (tasks, documents,
// buildings) is still active. Children are counted with deletedAt:null so a
// previously-trashed-then-restored permit can be re-deleted cleanly.
export async function deletePermit(permitId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
          documents: { where: { deletedAt: null } },
          buildings: true
        }
      }
    }
  });
  if (!permit) throw new Error("ההיתר לא נמצא");

  const blockers: string[] = [];
  if (permit._count.tasks > 0) blockers.push(`${permit._count.tasks} משימות`);
  if (permit._count.documents > 0)
    blockers.push(`${permit._count.documents} מסמכים`);
  if (permit._count.buildings > 0)
    blockers.push(`${permit._count.buildings} בניינים`);
  if (blockers.length > 0) {
    throw new Error(
      `לא ניתן למחוק את ההיתר — קיימים פריטים פעילים תחתיו: ${blockers.join(", ")}`
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.permit.update({
      where: { id: permitId },
      data: { deletedAt: now }
    });
    await logAudit(tx, {
      entityType: AuditEntity.PERMIT,
      entityId: permitId,
      action: AuditAction.DELETE,
      oldValue: { name: permit.name },
      newValue: { softDeletedAt: now.toISOString() },
      userId: me.id
    });
  });

  revalidatePath("/permits");
  revalidatePath("/settings/recycle-bin");
}

// Soft-delete a MasterDeal. Blocked if any non-deleted Permit references it.
export async function deleteMasterDeal(masterDealId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const deal = await prisma.masterDeal.findFirst({
    where: { id: masterDealId, deletedAt: null },
    select: {
      id: true,
      name: true,
      clientId: true,
      _count: { select: { permits: { where: { deletedAt: null } } } }
    }
  });
  if (!deal) throw new Error("העסקה לא נמצאה");
  if (deal._count.permits > 0) {
    throw new Error(
      `לא ניתן למחוק — ${deal._count.permits} היתרים פעילים שייכים לעסקה`
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.masterDeal.update({
      where: { id: masterDealId },
      data: { deletedAt: now }
    });
    await logAudit(tx, {
      entityType: AuditEntity.MASTER_DEAL,
      entityId: masterDealId,
      action: AuditAction.DELETE,
      oldValue: { name: deal.name, clientId: deal.clientId },
      newValue: { softDeletedAt: now.toISOString() },
      userId: me.id
    });
  });

  revalidatePath(`/clients/${deal.clientId}`);
  revalidatePath("/clients");
  revalidatePath("/settings/recycle-bin");
}
