"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null };

function parseDate(raw: FormDataEntryValue | null): Date | null {
  if (raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const n = Number(str.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function parseIntField(raw: FormDataEntryValue | null, fallback = 0): number {
  if (raw === null) return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createProject(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  let newPermitId: string;
  try {
    const me = await requireRole(["ADMIN"]);

    // ---- Client section ----
    const clientMode = String(formData.get("clientMode") || "existing");
    let existingClientId: string | null = null;
    let newClientData: {
      name: string;
      companyName: string | null;
      primaryContactName: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
    } | null = null;

    if (clientMode === "existing") {
      existingClientId = String(formData.get("existingClientId") || "");
      if (!existingClientId) return { error: "יש לבחור לקוח קיים" };
      const exists = await prisma.client.findUnique({
        where: { id: existingClientId },
        select: { id: true }
      });
      if (!exists) return { error: "הלקוח לא נמצא" };
    } else if (clientMode === "new") {
      const name = String(formData.get("clientName") || "").trim();
      if (!name) return { error: "שם הלקוח חובה" };
      newClientData = {
        name,
        companyName: String(formData.get("clientCompany") || "").trim() || null,
        primaryContactName:
          String(formData.get("clientContact") || "").trim() || null,
        phone: String(formData.get("clientPhone") || "").trim() || null,
        email: String(formData.get("clientEmail") || "").trim() || null,
        address: String(formData.get("clientAddress") || "").trim() || null
      };
    } else {
      return { error: "מצב לקוח לא חוקי" };
    }

    // ---- Deal section ----
    const dealName = String(formData.get("dealName") || "").trim();
    if (!dealName) return { error: "שם העסקה חובה" };
    const contractDate = parseDate(formData.get("contractDate"));
    const totalValue = parseAmount(formData.get("totalValue"));
    const dealNotes = String(formData.get("dealNotes") || "").trim() || null;

    // ---- Permit section ----
    const permitName = String(formData.get("permitName") || "").trim();
    if (!permitName) return { error: "שם ההיתר חובה" };
    const permitNumber =
      String(formData.get("permitNumber") || "").trim() || null;
    const permitType = String(formData.get("permitType") || "").trim() || null;
    const authorityId = String(formData.get("authorityId") || "");
    const buildingTypeId = String(formData.get("buildingTypeId") || "");
    if (!authorityId) return { error: "יש לבחור רשות" };
    if (!buildingTypeId) return { error: "יש לבחור סוג בניין" };
    const startDate = parseDate(formData.get("startDate"));
    const expectedCloseDate = parseDate(formData.get("expectedCloseDate"));

    const [authority, buildingType] = await Promise.all([
      prisma.authority.findUnique({
        where: { id: authorityId },
        select: { id: true, name: true }
      }),
      prisma.buildingType.findUnique({
        where: { id: buildingTypeId },
        select: { id: true, name: true }
      })
    ]);
    if (!authority) return { error: "הרשות לא נמצאה" };
    if (!buildingType) return { error: "סוג הבניין לא נמצא" };

    // ---- Buildings (optional) ----
    const buildingCount = parseIntField(formData.get("buildingCount"), 0);
    const buildingPrefix =
      String(formData.get("buildingPrefix") || "").trim() || buildingType.name;

    // ---- Task generation toggle ----
    const generateTasks = formData.get("generateTasks") !== "false";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve / create client
      let resolvedClientId: string;
      let resolvedClientName: string;
      if (newClientData) {
        const created = await tx.client.create({ data: newClientData });
        resolvedClientId = created.id;
        resolvedClientName = created.name;
        await logAudit(tx, {
          entityType: AuditEntity.CLIENT,
          entityId: created.id,
          action: AuditAction.CREATE,
          newValue: {
            name: created.name,
            companyName: created.companyName,
            phone: created.phone
          },
          userId: me.id
        });
      } else {
        const c = await tx.client.findUnique({
          where: { id: existingClientId! },
          select: { id: true, name: true }
        });
        if (!c) throw new Error("הלקוח לא נמצא (race condition)");
        resolvedClientId = c.id;
        resolvedClientName = c.name;
      }

      // 2. MasterDeal
      const deal = await tx.masterDeal.create({
        data: {
          clientId: resolvedClientId,
          name: dealName,
          contractDate,
          totalValue,
          notes: dealNotes,
          status: "ACTIVE"
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: deal.id,
        action: AuditAction.CREATE,
        newValue: {
          clientId: resolvedClientId,
          clientName: resolvedClientName,
          name: dealName,
          totalValue,
          contractDate: contractDate?.toISOString() ?? null
        },
        userId: me.id
      });

      // 3. Permit
      const permit = await tx.permit.create({
        data: {
          masterDealId: deal.id,
          authorityId,
          name: permitName,
          permitNumber,
          type: permitType,
          status: "DRAFT",
          startDate,
          expectedCloseDate,
          progressPercent: 0
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PERMIT,
        entityId: permit.id,
        action: AuditAction.CREATE,
        newValue: {
          masterDealId: deal.id,
          dealName,
          authorityId,
          authorityName: authority.name,
          buildingTypeId,
          buildingTypeName: buildingType.name,
          name: permitName,
          permitNumber
        },
        userId: me.id
      });

      // 4. Buildings (optional)
      let buildingsCreated = 0;
      if (buildingCount > 0) {
        await tx.building.createMany({
          data: Array.from({ length: buildingCount }, (_, i) => ({
            permitId: permit.id,
            label: `${buildingPrefix} ${i + 1}`,
            type: buildingType.name
          }))
        });
        buildingsCreated = buildingCount;
      }

      // 5. Auto-generate tasks from templates for (Authority + BuildingType)
      let tasksCreated = 0;
      let dependenciesCreated = 0;
      if (generateTasks) {
        const templates = await tx.taskTemplate.findMany({
          where: { authorityId, buildingTypeId, isActive: true },
          orderBy: { orderIndex: "asc" }
        });

        if (templates.length > 0) {
          const baseDate = startDate ?? new Date();
          const taskRows = templates.map((tmpl) => ({
            permitId: permit.id,
            templateId: tmpl.id,
            name: tmpl.name,
            description: tmpl.description,
            dueDate:
              tmpl.defaultDurationDays !== null
                ? new Date(baseDate.getTime() + tmpl.defaultDurationDays * DAY_MS)
                : null,
            status: "OPEN" as const,
            priority: "NORMAL" as const
          }));

          // createManyAndReturn lets us map templateId → taskId in a single round-trip.
          const createdTasks = await tx.task.createManyAndReturn({
            data: taskRows,
            select: { id: true, templateId: true }
          });
          tasksCreated = createdTasks.length;

          const templateToTaskId = new Map<string, string>();
          for (const t of createdTasks) {
            if (t.templateId) templateToTaskId.set(t.templateId, t.id);
          }

          const templateIds = Array.from(templateToTaskId.keys());
          if (templateIds.length > 0) {
            const templateDeps = await tx.taskTemplateDependency.findMany({
              where: {
                templateId: { in: templateIds },
                dependsOnTemplateId: { in: templateIds }
              }
            });
            if (templateDeps.length > 0) {
              await tx.taskDependency.createMany({
                data: templateDeps.map((dep) => ({
                  taskId: templateToTaskId.get(dep.templateId)!,
                  dependsOnTaskId: templateToTaskId.get(dep.dependsOnTemplateId)!
                }))
              });
              dependenciesCreated = templateDeps.length;
            }
          }

          await logAudit(tx, {
            entityType: AuditEntity.PERMIT,
            entityId: permit.id,
            action: AuditAction.UPDATE,
            newValue: {
              event: "tasks_generated_from_templates",
              tasksCreated,
              dependenciesCreated,
              authorityName: authority.name,
              buildingTypeName: buildingType.name
            },
            userId: me.id
          });
        }
      }

      return {
        permitId: permit.id,
        tasksCreated,
        dependenciesCreated,
        buildingsCreated
      };
    });

    newPermitId = result.permitId;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה ביצירת הפרויקט"
    };
  }

  // Redirect OUTSIDE try/catch — `redirect()` throws NEXT_REDIRECT and must propagate.
  revalidatePath("/permits");
  redirect(`/permits/${newPermitId}/tasks`);
}
