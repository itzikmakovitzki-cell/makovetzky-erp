"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null; ok: boolean };

export async function submitTaskTemplate(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const kind = String(formData.get("kind") || "");
    const authorityId = String(formData.get("authorityId") || "");
    const buildingTypeId = String(formData.get("buildingTypeId") || "");
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim() || null;
    const durationRaw = String(formData.get("defaultDurationDays") || "").trim();
    const defaultDurationDays = durationRaw ? Number(durationRaw) : null;
    const orderRaw = String(formData.get("orderIndex") || "").trim();
    const orderIndex = orderRaw ? Number(orderRaw) : 0;

    if (!name) return { error: "שם התבנית חובה", ok: false };
    if (!authorityId || !buildingTypeId) {
      return { error: "יש לבחור רשות וסוג בניין", ok: false };
    }
    if (defaultDurationDays !== null && (Number.isNaN(defaultDurationDays) || defaultDurationDays < 0)) {
      return { error: "משך ימים לא חוקי", ok: false };
    }

    if (kind === "create") {
      try {
        await prisma.$transaction(async (tx) => {
          const t = await tx.taskTemplate.create({
            data: {
              authorityId,
              buildingTypeId,
              name,
              description,
              defaultDurationDays,
              orderIndex,
              isActive: true
            }
          });
          await logAudit(tx, {
            entityType: AuditEntity.TASK_TEMPLATE,
            entityId: t.id,
            action: AuditAction.CREATE,
            newValue: {
              authorityId,
              buildingTypeId,
              name,
              defaultDurationDays,
              orderIndex
            },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return {
            error: "תבנית בשם זה כבר קיימת לרשות + סוג הבניין",
            ok: false
          };
        }
        throw e;
      }
      revalidatePath("/settings/templates");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const id = String(formData.get("id") || "");
      if (!id) return { error: "חסר מזהה", ok: false };
      const existing = await prisma.taskTemplate.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          description: true,
          defaultDurationDays: true,
          orderIndex: true
        }
      });
      if (!existing) return { error: "התבנית לא נמצאה", ok: false };

      try {
        await prisma.$transaction(async (tx) => {
          await tx.taskTemplate.update({
            where: { id },
            data: { name, description, defaultDurationDays, orderIndex }
          });
          await logAudit(tx, {
            entityType: AuditEntity.TASK_TEMPLATE,
            entityId: id,
            action: AuditAction.UPDATE,
            oldValue: {
              name: existing.name,
              defaultDurationDays: existing.defaultDurationDays,
              orderIndex: existing.orderIndex
            },
            newValue: { name, defaultDurationDays, orderIndex },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return {
            error: "תבנית בשם זה כבר קיימת לרשות + סוג הבניין",
            ok: false
          };
        }
        throw e;
      }
      revalidatePath("/settings/templates");
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

export async function deleteTaskTemplate(id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const t = await prisma.taskTemplate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: { select: { tasks: true } }
    }
  });
  if (!t) throw new Error("התבנית לא נמצאה");
  if (t._count.tasks > 0) {
    throw new Error(
      `לא ניתן למחוק — ${t._count.tasks} משימות פעילות נוצרו מתבנית זו`
    );
  }

  await prisma.$transaction(async (tx) => {
    // dependsOn / dependedOnBy are cascade-deleted via the FK in schema.
    await tx.taskTemplate.delete({ where: { id } });
    await logAudit(tx, {
      entityType: AuditEntity.TASK_TEMPLATE,
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: { name: t.name },
      userId: me.id
    });
  });

  revalidatePath("/settings/templates");
}

// BFS from `dependsOnTemplateId` over the dependsOn graph; if we reach
// `templateId`, the new edge would close a cycle and is rejected.
async function wouldCreateCycle(
  tx: Prisma.TransactionClient,
  templateId: string,
  dependsOnTemplateId: string
): Promise<boolean> {
  if (templateId === dependsOnTemplateId) return true;
  const visited = new Set<string>();
  const queue: string[] = [dependsOnTemplateId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === templateId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const deps = await tx.taskTemplateDependency.findMany({
      where: { templateId: current },
      select: { dependsOnTemplateId: true }
    });
    for (const d of deps) queue.push(d.dependsOnTemplateId);
  }
  return false;
}

export async function addTemplateDependency(
  templateId: string,
  dependsOnTemplateId: string
): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  if (templateId === dependsOnTemplateId) {
    throw new Error("תבנית לא יכולה להיות תלויה בעצמה");
  }

  const [t, dep] = await Promise.all([
    prisma.taskTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        authorityId: true,
        buildingTypeId: true
      }
    }),
    prisma.taskTemplate.findUnique({
      where: { id: dependsOnTemplateId },
      select: {
        id: true,
        name: true,
        authorityId: true,
        buildingTypeId: true
      }
    })
  ]);

  if (!t || !dep) throw new Error("תבנית לא נמצאה");
  if (t.authorityId !== dep.authorityId || t.buildingTypeId !== dep.buildingTypeId) {
    throw new Error("תלות חייבת להיות בין תבניות מאותה רשות + סוג בניין");
  }

  await prisma.$transaction(async (tx) => {
    if (await wouldCreateCycle(tx, templateId, dependsOnTemplateId)) {
      throw new Error(
        `הוספת התלות תיצור מעגל (cycle): "${t.name}" כבר תלוי בעקיפין ב-"${dep.name}"`
      );
    }
    try {
      await tx.taskTemplateDependency.create({
        data: { templateId, dependsOnTemplateId }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("התלות הזו כבר קיימת");
      }
      throw e;
    }
    await logAudit(tx, {
      entityType: AuditEntity.TASK_TEMPLATE_DEPENDENCY,
      entityId: `${templateId}:${dependsOnTemplateId}`,
      action: AuditAction.CREATE,
      newValue: {
        templateId,
        templateName: t.name,
        dependsOnTemplateId,
        dependsOnTemplateName: dep.name
      },
      userId: me.id
    });
  });

  revalidatePath("/settings/templates");
}

export async function removeTemplateDependency(
  templateId: string,
  dependsOnTemplateId: string
): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const dep = await prisma.taskTemplateDependency.findUnique({
    where: {
      templateId_dependsOnTemplateId: { templateId, dependsOnTemplateId }
    },
    include: {
      template: { select: { id: true, name: true } },
      dependsOnTemplate: { select: { id: true, name: true } }
    }
  });
  if (!dep) throw new Error("התלות לא נמצאה");

  await prisma.$transaction(async (tx) => {
    await tx.taskTemplateDependency.delete({
      where: {
        templateId_dependsOnTemplateId: { templateId, dependsOnTemplateId }
      }
    });
    await logAudit(tx, {
      entityType: AuditEntity.TASK_TEMPLATE_DEPENDENCY,
      entityId: `${templateId}:${dependsOnTemplateId}`,
      action: AuditAction.DELETE,
      oldValue: {
        templateId,
        templateName: dep.template.name,
        dependsOnTemplateId,
        dependsOnTemplateName: dep.dependsOnTemplate.name
      },
      userId: me.id
    });
  });

  revalidatePath("/settings/templates");
}
