"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null; ok: boolean };

export async function submitAuthority(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const kind = String(formData.get("kind") || "");
    const name = String(formData.get("name") || "").trim();
    const region = String(formData.get("region") || "").trim() || null;
    const contactInfo = String(formData.get("contactInfo") || "").trim() || null;

    if (!name) return { error: "שם הרשות חובה", ok: false };

    if (kind === "create") {
      try {
        await prisma.$transaction(async (tx) => {
          const a = await tx.authority.create({ data: { name, region, contactInfo } });
          await logAudit(tx, {
            entityType: AuditEntity.AUTHORITY,
            entityId: a.id,
            action: AuditAction.CREATE,
            newValue: { name, region, contactInfo },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "רשות בשם זה כבר קיימת", ok: false };
        }
        throw e;
      }
      revalidatePath("/settings/authorities");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const id = String(formData.get("id") || "");
      if (!id) return { error: "חסר מזהה", ok: false };
      const existing = await prisma.authority.findUnique({
        where: { id },
        select: { id: true, name: true, region: true, contactInfo: true }
      });
      if (!existing) return { error: "הרשות לא נמצאה", ok: false };

      try {
        await prisma.$transaction(async (tx) => {
          await tx.authority.update({
            where: { id },
            data: { name, region, contactInfo }
          });
          await logAudit(tx, {
            entityType: AuditEntity.AUTHORITY,
            entityId: id,
            action: AuditAction.UPDATE,
            oldValue: {
              name: existing.name,
              region: existing.region,
              contactInfo: existing.contactInfo
            },
            newValue: { name, region, contactInfo },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "רשות בשם זה כבר קיימת", ok: false };
        }
        throw e;
      }
      revalidatePath("/settings/authorities");
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

export async function deleteAuthority(id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const a = await prisma.authority.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          permits: { where: { deletedAt: null } },
          taskTemplates: true,
          wikiEntries: true
        }
      }
    }
  });
  if (!a) throw new Error("הרשות לא נמצאה");
  if (a._count.permits > 0) {
    throw new Error(
      `לא ניתן למחוק — ${a._count.permits} היתרים פעילים שייכים לרשות זו`
    );
  }
  if (a._count.taskTemplates > 0) {
    throw new Error(
      `לא ניתן למחוק — ${a._count.taskTemplates} תבניות משימות שייכות לרשות זו`
    );
  }

  await prisma.$transaction(async (tx) => {
    // wikiEntries are FK-cascade-deleted on Authority delete (per schema).
    await tx.authority.delete({ where: { id } });
    await logAudit(tx, {
      entityType: AuditEntity.AUTHORITY,
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: { name: a.name },
      userId: me.id
    });
  });

  revalidatePath("/settings/authorities");
}
