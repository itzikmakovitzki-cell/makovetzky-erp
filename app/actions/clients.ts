"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null; ok: boolean };

function readClientPayload(formData: FormData): {
  companyName: string;
  hp: string | null;
  contactName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
} | { error: string } {
  const companyName = String(formData.get("companyName") || "").trim();
  const contactName = String(formData.get("contactName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  if (!companyName) return { error: "שם החברה חובה" };
  if (!contactName) return { error: "שם איש קשר חובה" };
  if (!phone) return { error: "טלפון איש קשר חובה" };
  return {
    companyName,
    hp: String(formData.get("hp") || "").trim() || null,
    contactName,
    phone,
    email: String(formData.get("email") || "").trim() || null,
    address: String(formData.get("address") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null
  };
}

export async function submitClient(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const kind = String(formData.get("kind") || "");

    const parsed = readClientPayload(formData);
    if ("error" in parsed) return { error: parsed.error, ok: false };

    if (kind === "create") {
      await prisma.$transaction(async (tx) => {
        const c = await tx.client.create({ data: parsed });
        await logAudit(tx, {
          entityType: AuditEntity.CLIENT,
          entityId: c.id,
          action: AuditAction.CREATE,
          newValue: parsed,
          userId: me.id
        });
      });
      revalidatePath("/clients");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const id = String(formData.get("id") || "");
      if (!id) return { error: "חסר מזהה", ok: false };
      const existing = await prisma.client.findFirst({
        where: { id, deletedAt: null }
      });
      if (!existing) return { error: "הלקוח לא נמצא", ok: false };

      await prisma.$transaction(async (tx) => {
        await tx.client.update({ where: { id }, data: parsed });
        await logAudit(tx, {
          entityType: AuditEntity.CLIENT,
          entityId: id,
          action: AuditAction.UPDATE,
          oldValue: {
            companyName: existing.companyName,
            hp: existing.hp,
            contactName: existing.contactName,
            phone: existing.phone,
            email: existing.email,
            address: existing.address,
            notes: existing.notes
          },
          newValue: parsed,
          userId: me.id
        });
      });
      revalidatePath("/clients");
      revalidatePath(`/clients/${id}`);
      return { error: null, ok: true };
    }

    return { error: "פעולה לא חוקית", ok: false };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה לא צפויה",
      ok: false
    };
  }
}

type DeleteResult = { ok: true } | { ok: false; error: string };

// Soft-delete client + cascade into every active MasterDeal under it (which
// in turn cascades to permits, tasks, documents — same chain as
// deleteMasterDeal). The previous version of this action blocked when active
// deals existed; the admin asked for cascade so a wrong-customer entry can
// be retired cleanly. Returns the structured DeleteResult shape that
// SoftDeleteButton can consume.
export async function deleteClient(id: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const c = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        companyName: true,
        masterDeals: {
          where: { deletedAt: null },
          select: {
            id: true,
            permits: {
              where: { deletedAt: null },
              select: { id: true }
            }
          }
        }
      }
    });
    if (!c) return { ok: false, error: "הלקוח לא נמצא" };

    const now = new Date();
    const dealIds = c.masterDeals.map((d) => d.id);
    const permitIds = c.masterDeals.flatMap((d) => d.permits.map((p) => p.id));

    await prisma.$transaction(async (tx) => {
      if (permitIds.length > 0) {
        const childWhere = {
          permitId: { in: permitIds },
          deletedAt: null as Date | null
        };
        await tx.task.updateMany({ where: childWhere, data: { deletedAt: now } });
        await tx.document.updateMany({ where: childWhere, data: { deletedAt: now } });
        await tx.permit.updateMany({
          where: { id: { in: permitIds }, deletedAt: null },
          data: { deletedAt: now }
        });
      }
      if (dealIds.length > 0) {
        await tx.masterDeal.updateMany({
          where: { id: { in: dealIds }, deletedAt: null },
          data: { deletedAt: now }
        });
      }
      await tx.client.update({ where: { id }, data: { deletedAt: now } });
      await logAudit(tx, {
        entityType: AuditEntity.CLIENT,
        entityId: id,
        action: AuditAction.DELETE,
        oldValue: { companyName: c.companyName },
        newValue: {
          softDeletedAt: now.toISOString(),
          cascadedDeals: dealIds.length,
          cascadedPermits: permitIds.length
        },
        userId: me.id
      });
    });

    revalidatePath("/clients");
    revalidatePath("/projects");
    revalidatePath("/permits");
    revalidatePath("/tasks");
    revalidatePath("/settings/recycle-bin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת הלקוח נכשלה"
    };
  }
}
