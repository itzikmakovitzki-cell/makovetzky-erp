"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, SupplierCommissionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

export type SupplierFormState = { error: string | null; ok: boolean };
type DeleteResult = { ok: true } | { ok: false; error: string };

// Parse the (type, value) commission pair from a form. PERCENT values are
// validated to live in [0, 100]; FIXED values must be non-negative; either
// can be unset (both null = "use whatever's on the assignment").
function parseCommission(formData: FormData): {
  ok: true;
  type: SupplierCommissionType | null;
  value: string | null;
} | { ok: false; error: string } {
  const typeRaw = String(formData.get("defaultCommissionType") || "").trim();
  const valueRaw = String(formData.get("defaultCommissionValue") || "").trim();

  if (!typeRaw && !valueRaw) return { ok: true, type: null, value: null };
  if (typeRaw && !valueRaw) {
    return { ok: false, error: "ערך עמלה חסר — סמנת סוג בלי מספר" };
  }
  if (valueRaw && !typeRaw) {
    return { ok: false, error: "סוג עמלה חסר — מילאת מספר בלי לבחור 'סכום' או 'אחוז'" };
  }
  if (typeRaw !== "FIXED" && typeRaw !== "PERCENT") {
    return { ok: false, error: "סוג עמלה לא חוקי" };
  }

  const n = Number(valueRaw);
  if (Number.isNaN(n) || n < 0) {
    return { ok: false, error: "ערך עמלה חייב להיות מספר אי-שלילי" };
  }
  if (typeRaw === "PERCENT" && n > 100) {
    return { ok: false, error: "אחוז עמלה לא יכול להיות מעל 100" };
  }
  return {
    ok: true,
    type: typeRaw as SupplierCommissionType,
    value: n.toFixed(2)
  };
}

// Common payload extracted from a supplier form. Shared between create + update
// so the field set stays in lockstep across both flows.
function readSupplierForm(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "").trim() || null;
  const contactName = String(formData.get("contactName") || "").trim() || null;
  const phone = String(formData.get("phone") || "").trim() || null;
  const email = String(formData.get("email") || "").trim() || null;
  const website = String(formData.get("website") || "").trim() || null;
  const services = String(formData.get("services") || "").trim() || null;
  const defaultPaymentTerms =
    String(formData.get("defaultPaymentTerms") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;
  // Block 30 (Partners Marketplace) — opt-in publishing + client-facing copy.
  // Checkbox submits "true" when checked, absent when not.
  const isPublic = String(formData.get("isPublic") || "") === "true";
  const marketingDescription =
    String(formData.get("marketingDescription") || "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  return {
    name,
    type,
    contactName,
    phone,
    email,
    website,
    services,
    defaultPaymentTerms,
    notes,
    isPublic,
    marketingDescription,
    logoUrl
  };
}

// Create a supplier. ADMIN-only, audit-logged. Supplier.name has no unique
// constraint (duplicates are allowed by design), so no P2002 handling needed.
export async function submitSupplier(
  _prev: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const fields = readSupplierForm(formData);
    if (!fields.name) return { error: "שם הספק חובה", ok: false };

    const commission = parseCommission(formData);
    if (!commission.ok) return { error: commission.error, ok: false };

    await prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: {
          ...fields,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
            ? new Prisma.Decimal(commission.value)
            : null
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: s.id,
        action: AuditAction.CREATE,
        newValue: {
          ...fields,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// Update an existing supplier. Same shape + validation as create; the form
// posts `supplierId` as a hidden field. Captures both the old and new values
// in the audit log so changes are diff-able after the fact.
export async function updateSupplier(
  _prev: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const supplierId = String(formData.get("supplierId") || "").trim();
    if (!supplierId) return { error: "חסר מזהה ספק", ok: false };

    const existing = await prisma.supplier.findUnique({
      where: { id: supplierId }
    });
    if (!existing) return { error: "הספק לא נמצא", ok: false };

    const fields = readSupplierForm(formData);
    if (!fields.name) return { error: "שם הספק חובה", ok: false };

    const commission = parseCommission(formData);
    if (!commission.ok) return { error: commission.error, ok: false };

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          ...fields,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
            ? new Prisma.Decimal(commission.value)
            : null
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: supplierId,
        action: AuditAction.UPDATE,
        oldValue: {
          name: existing.name,
          type: existing.type,
          contactName: existing.contactName,
          phone: existing.phone,
          email: existing.email,
          website: existing.website,
          services: existing.services,
          defaultCommissionType: existing.defaultCommissionType,
          defaultCommissionValue: existing.defaultCommissionValue?.toString() ?? null,
          defaultPaymentTerms: existing.defaultPaymentTerms,
          notes: existing.notes,
          isPublic: existing.isPublic,
          marketingDescription: existing.marketingDescription,
          logoUrl: existing.logoUrl
        },
        newValue: {
          ...fields,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${supplierId}`);
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// Hard-delete a supplier (Supplier has no soft-delete column today). The
// schema's FK is Restrict from SupplierTaskAssignment → so we delete every
// assignment in the same transaction as a deliberate cascade. Audit captures
// the counts. ADMIN-only.
//
// NOTE: this hard-deletes assignment rows too — there's no recycle-bin
// recovery for assignments (the schema never had one). The confirm dialog
// surfaces the count so the admin sees what they're about to lose.
export async function deleteSupplier(supplierId: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        _count: { select: { taskAssignments: true } }
      }
    });
    if (!supplier) return { ok: false, error: "הספק לא נמצא" };

    const assignmentCount = supplier._count.taskAssignments;
    await prisma.$transaction(async (tx) => {
      if (assignmentCount > 0) {
        await tx.supplierTaskAssignment.deleteMany({ where: { supplierId } });
      }
      await tx.supplier.delete({ where: { id: supplierId } });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: supplierId,
        action: AuditAction.DELETE,
        oldValue: { name: supplier.name },
        newValue: {
          hardDeletedAt: new Date().toISOString(),
          cascadedAssignments: assignmentCount
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath("/finances/supplier-commissions");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת הספק נכשלה"
    };
  }
}
