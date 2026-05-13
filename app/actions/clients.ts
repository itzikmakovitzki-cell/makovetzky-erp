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
      const existing = await prisma.client.findUnique({ where: { id } });
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

export async function deleteClient(id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const c = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      _count: { select: { masterDeals: true, portalAccesses: true } }
    }
  });
  if (!c) throw new Error("הלקוח לא נמצא");
  if (c._count.masterDeals > 0) {
    throw new Error(
      `לא ניתן למחוק — ${c._count.masterDeals} עסקאות שייכות ללקוח זה`
    );
  }

  await prisma.$transaction(async (tx) => {
    // PortalAccess rows cascade automatically (per schema FK).
    await tx.client.delete({ where: { id } });
    await logAudit(tx, {
      entityType: AuditEntity.CLIENT,
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: { companyName: c.companyName },
      userId: me.id
    });
  });

  revalidatePath("/clients");
}
