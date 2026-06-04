"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Block 30 polish #2 — PartnerCategory CRUD. Admin-only, audit-logged,
// fully transactional. Categories drive the filter pills on the
// /portal/partners + /partners marketplace.

export type CategoryFormState = { error: string | null; ok: boolean };
type ActionResult = { ok: true } | { ok: false; error: string };

function readCategoryForm(formData: FormData): {
  name: string;
  description: string | null;
  displayOrder: number;
} {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const orderRaw = String(formData.get("displayOrder") || "").trim();
  const parsed = Number(orderRaw);
  const displayOrder = Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  return { name, description, displayOrder };
}

export async function createPartnerCategory(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const fields = readCategoryForm(formData);
    if (!fields.name) return { error: "שם הקטגוריה חובה", ok: false };

    await prisma.$transaction(async (tx) => {
      const c = await tx.partnerCategory.create({ data: fields });
      await logAudit(tx, {
        entityType: AuditEntity.PARTNER_CATEGORY,
        entityId: c.id,
        action: AuditAction.CREATE,
        newValue: { ...fields },
        userId: me.id
      });
    });

    revalidatePath("/settings/partner-categories");
    revalidatePath("/portal/partners");
    revalidatePath("/partners");
    revalidatePath("/suppliers");
    return { error: null, ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "כבר קיימת קטגוריה בשם זה", ok: false };
    }
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

export async function updatePartnerCategory(
  _prev: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const id = String(formData.get("categoryId") || "").trim();
    if (!id) return { error: "חסר מזהה קטגוריה", ok: false };

    const existing = await prisma.partnerCategory.findUnique({ where: { id } });
    if (!existing) return { error: "הקטגוריה לא נמצאה", ok: false };

    const fields = readCategoryForm(formData);
    if (!fields.name) return { error: "שם הקטגוריה חובה", ok: false };

    await prisma.$transaction(async (tx) => {
      await tx.partnerCategory.update({ where: { id }, data: fields });
      await logAudit(tx, {
        entityType: AuditEntity.PARTNER_CATEGORY,
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: {
          name: existing.name,
          description: existing.description,
          displayOrder: existing.displayOrder
        },
        newValue: { ...fields },
        userId: me.id
      });
    });

    revalidatePath("/settings/partner-categories");
    revalidatePath("/portal/partners");
    revalidatePath("/partners");
    revalidatePath("/suppliers");
    return { error: null, ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "כבר קיימת קטגוריה בשם זה", ok: false };
    }
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// Hard-delete. FK on Supplier.categoryId is SET NULL so suppliers under
// this category become "no category" rather than blocking the delete.
// The count is captured in the audit log so we can trace which suppliers
// got orphaned by which delete event.
export async function deletePartnerCategory(categoryId: string): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const cat = await prisma.partnerCategory.findUnique({
      where: { id: categoryId },
      select: {
        id: true,
        name: true,
        _count: { select: { suppliers: true } }
      }
    });
    if (!cat) return { ok: false, error: "הקטגוריה לא נמצאה" };

    await prisma.$transaction(async (tx) => {
      await tx.partnerCategory.delete({ where: { id: categoryId } });
      await logAudit(tx, {
        entityType: AuditEntity.PARTNER_CATEGORY,
        entityId: categoryId,
        action: AuditAction.DELETE,
        oldValue: { name: cat.name },
        newValue: {
          hardDeletedAt: new Date().toISOString(),
          suppliersDetached: cat._count.suppliers
        },
        userId: me.id
      });
    });

    revalidatePath("/settings/partner-categories");
    revalidatePath("/portal/partners");
    revalidatePath("/partners");
    revalidatePath("/suppliers");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת הקטגוריה נכשלה"
    };
  }
}
