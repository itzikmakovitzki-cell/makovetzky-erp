"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null; ok: boolean };

export async function submitBuildingType(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const kind = String(formData.get("kind") || "");
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim() || null;

    if (!name) return { error: "שם חובה", ok: false };

    if (kind === "create") {
      try {
        await prisma.$transaction(async (tx) => {
          const bt = await tx.buildingType.create({ data: { name, description } });
          await logAudit(tx, {
            entityType: AuditEntity.BUILDING_TYPE,
            entityId: bt.id,
            action: AuditAction.CREATE,
            newValue: { name, description },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "סוג בניין בשם זה כבר קיים", ok: false };
        }
        throw e;
      }
      revalidatePath("/settings/building-types");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const id = String(formData.get("id") || "");
      if (!id) return { error: "חסר מזהה", ok: false };
      const existing = await prisma.buildingType.findUnique({
        where: { id },
        select: { id: true, name: true, description: true }
      });
      if (!existing) return { error: "סוג בניין לא נמצא", ok: false };

      try {
        await prisma.$transaction(async (tx) => {
          await tx.buildingType.update({ where: { id }, data: { name, description } });
          await logAudit(tx, {
            entityType: AuditEntity.BUILDING_TYPE,
            entityId: id,
            action: AuditAction.UPDATE,
            oldValue: { name: existing.name, description: existing.description },
            newValue: { name, description },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "סוג בניין בשם זה כבר קיים", ok: false };
        }
        throw e;
      }
      revalidatePath("/settings/building-types");
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

export async function deleteBuildingType(id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const bt = await prisma.buildingType.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { taskTemplates: true } }
    }
  });
  if (!bt) throw new Error("סוג בניין לא נמצא");
  if (bt._count.taskTemplates > 0) {
    throw new Error(
      `לא ניתן למחוק — קיימות ${bt._count.taskTemplates} תבניות משימות לסוג זה`
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.buildingType.delete({ where: { id } });
    await logAudit(tx, {
      entityType: AuditEntity.BUILDING_TYPE,
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: { name: bt.name },
      userId: me.id
    });
  });

  revalidatePath("/settings/building-types");
}
