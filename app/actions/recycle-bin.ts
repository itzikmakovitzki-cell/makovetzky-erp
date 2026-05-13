"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { isTrashableKind, type TrashableKind } from "@/lib/soft-delete";
import { deleteFromStorage, isStoragePath } from "@/lib/supabase-storage";

const ENTITY_BY_KIND: Record<TrashableKind, string> = {
  client: AuditEntity.CLIENT,
  masterDeal: AuditEntity.MASTER_DEAL,
  permit: AuditEntity.PERMIT,
  task: AuditEntity.TASK,
  document: AuditEntity.DOCUMENT
};

const LABEL_BY_KIND: Record<TrashableKind, string> = {
  client: "לקוח",
  masterDeal: "עסקה",
  permit: "היתר",
  task: "משימה",
  document: "מסמך"
};

// Restore puts `deletedAt = null` on the row. Restoring a parent does NOT
// cascade-restore its previously-deleted children; admins do that manually
// from the recycle bin if they want.
export async function restoreTrashed(kind: string, id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  if (!isTrashableKind(kind)) throw new Error("סוג פריט לא חוקי");

  const result = await restoreByKind(kind, id, me.id);
  revalidatePath("/settings/recycle-bin");
  revalidatePath("/clients");
  revalidatePath("/permits");
  revalidatePath("/tasks");
  if (result.permitId) {
    revalidatePath(`/permits/${result.permitId}`, "layout");
  }
  if (result.clientId) {
    revalidatePath(`/clients/${result.clientId}`);
  }
}

// Permanent delete — actual Prisma `delete` (FK cascades fire). For documents,
// we also remove the underlying object from Supabase Storage when applicable.
// The audit log row stays (audit is immutable by convention).
export async function purgeTrashed(kind: string, id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  if (!isTrashableKind(kind)) throw new Error("סוג פריט לא חוקי");

  const result = await purgeByKind(kind, id, me.id);
  revalidatePath("/settings/recycle-bin");
  revalidatePath("/clients");
  revalidatePath("/permits");
  revalidatePath("/tasks");
  if (result.permitId) {
    revalidatePath(`/permits/${result.permitId}`, "layout");
  }
  if (result.clientId) {
    revalidatePath(`/clients/${result.clientId}`);
  }
}

// ----- internals -----

async function restoreByKind(
  kind: TrashableKind,
  id: string,
  userId: string
): Promise<{ permitId?: string; clientId?: string }> {
  return prisma.$transaction(async (tx) => {
    let label = "(לא נמצא)";
    let permitId: string | undefined;
    let clientId: string | undefined;

    if (kind === "client") {
      const c = await tx.client.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, companyName: true }
      });
      if (!c) throw new Error("הלקוח לא נמצא בסל המחזור");
      await tx.client.update({ where: { id }, data: { deletedAt: null } });
      label = c.companyName;
      clientId = c.id;
    } else if (kind === "masterDeal") {
      const d = await tx.masterDeal.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, name: true, clientId: true }
      });
      if (!d) throw new Error("העסקה לא נמצאה בסל המחזור");
      await tx.masterDeal.update({ where: { id }, data: { deletedAt: null } });
      label = d.name;
      clientId = d.clientId;
    } else if (kind === "permit") {
      const p = await tx.permit.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, name: true }
      });
      if (!p) throw new Error("ההיתר לא נמצא בסל המחזור");
      await tx.permit.update({ where: { id }, data: { deletedAt: null } });
      label = p.name;
      permitId = p.id;
    } else if (kind === "task") {
      const t = await tx.task.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, name: true, permitId: true }
      });
      if (!t) throw new Error("המשימה לא נמצאה בסל המחזור");
      await tx.task.update({ where: { id }, data: { deletedAt: null } });
      label = t.name;
      permitId = t.permitId;
    } else if (kind === "document") {
      const d = await tx.document.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, fileName: true, permitId: true }
      });
      if (!d) throw new Error("המסמך לא נמצא בסל המחזור");
      await tx.document.update({ where: { id }, data: { deletedAt: null } });
      label = d.fileName;
      permitId = d.permitId;
    }

    await logAudit(tx, {
      entityType: ENTITY_BY_KIND[kind],
      entityId: id,
      action: AuditAction.UPDATE,
      newValue: { restoredFromTrash: true, label },
      userId
    });

    return { permitId, clientId };
  });
}

async function purgeByKind(
  kind: TrashableKind,
  id: string,
  userId: string
): Promise<{ permitId?: string; clientId?: string; storagePath?: string }> {
  // Storage cleanup is best-effort and happens AFTER the DB commit so a failed
  // storage call doesn't roll back the row deletion (and conversely a failed
  // DB delete leaves the file untouched).
  const result = await prisma.$transaction(async (tx) => {
    let label = "(לא נמצא)";
    let permitId: string | undefined;
    let clientId: string | undefined;
    let storagePath: string | undefined;

    if (kind === "client") {
      const c = await tx.client.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          id: true,
          companyName: true,
          _count: { select: { masterDeals: true, portalAccesses: true } }
        }
      });
      if (!c) throw new Error("הלקוח לא נמצא בסל המחזור");
      if (c._count.masterDeals > 0) {
        throw new Error(
          `לא ניתן למחוק לצמיתות — ${c._count.masterDeals} עסקאות עדיין מקושרות (כולל סל המחזור). מחק אותן לצמיתות קודם.`
        );
      }
      await tx.client.delete({ where: { id } });
      label = c.companyName;
      clientId = c.id;
    } else if (kind === "masterDeal") {
      const d = await tx.masterDeal.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          id: true,
          name: true,
          clientId: true,
          _count: { select: { permits: true } }
        }
      });
      if (!d) throw new Error("העסקה לא נמצאה בסל המחזור");
      if (d._count.permits > 0) {
        throw new Error(
          `לא ניתן למחוק לצמיתות — ${d._count.permits} היתרים עדיין מקושרים. מחק אותם לצמיתות קודם.`
        );
      }
      await tx.masterDeal.delete({ where: { id } });
      label = d.name;
      clientId = d.clientId;
    } else if (kind === "permit") {
      const p = await tx.permit.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          id: true,
          name: true,
          _count: {
            select: { tasks: true, documents: true, buildings: true }
          }
        }
      });
      if (!p) throw new Error("ההיתר לא נמצא בסל המחזור");
      // Even after soft-delete, there may be soft-deleted Tasks/Documents
      // (counts here are unfiltered — they include trashed rows).
      const blockers: string[] = [];
      if (p._count.tasks > 0) blockers.push(`${p._count.tasks} משימות`);
      if (p._count.documents > 0)
        blockers.push(`${p._count.documents} מסמכים`);
      if (p._count.buildings > 0)
        blockers.push(`${p._count.buildings} בניינים`);
      if (blockers.length > 0) {
        throw new Error(
          `לא ניתן למחוק לצמיתות — ${blockers.join(", ")} עדיין משויכים להיתר. מחק אותם לצמיתות קודם.`
        );
      }
      await tx.permit.delete({ where: { id } });
      label = p.name;
      permitId = p.id;
    } else if (kind === "task") {
      const t = await tx.task.findFirst({
        where: { id, deletedAt: { not: null } },
        select: {
          id: true,
          name: true,
          permitId: true,
          milestone: { select: { id: true } },
          _count: { select: { supplierAssignments: true } }
        }
      });
      if (!t) throw new Error("המשימה לא נמצאה בסל המחזור");
      if (t.milestone) {
        throw new Error(
          "לא ניתן למחוק לצמיתות — המשימה מהווה טריגר לאבן דרך פעילה"
        );
      }
      if (t._count.supplierAssignments > 0) {
        throw new Error(
          `לא ניתן למחוק לצמיתות — ${t._count.supplierAssignments} שיוכי ספק מקושרים`
        );
      }
      await tx.task.delete({ where: { id } });
      label = t.name;
      permitId = t.permitId;
    } else if (kind === "document") {
      const d = await tx.document.findFirst({
        where: { id, deletedAt: { not: null } },
        select: { id: true, fileName: true, permitId: true, fileUrl: true }
      });
      if (!d) throw new Error("המסמך לא נמצא בסל המחזור");
      await tx.document.delete({ where: { id } });
      label = d.fileName;
      permitId = d.permitId;
      if (isStoragePath(d.fileUrl)) storagePath = d.fileUrl;
    }

    await logAudit(tx, {
      entityType: ENTITY_BY_KIND[kind],
      entityId: id,
      action: AuditAction.DELETE,
      newValue: {
        purgedAt: new Date().toISOString(),
        label,
        kind: LABEL_BY_KIND[kind],
        storagePath
      },
      userId
    });

    return { permitId, clientId, storagePath };
  });

  if (result.storagePath) {
    try {
      await deleteFromStorage(result.storagePath);
    } catch {
      // Best-effort: a stranded storage object is preferable to a row that
      // came back because of an unrelated storage outage.
    }
  }

  return result;
}
