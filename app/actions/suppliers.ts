"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { validateCommissionPair } from "@/lib/commissions";
import {
  buildSupplierLogoStoragePath,
  uploadToStorage
} from "@/lib/supabase-storage";

// Block 30 polish — logos can come in two flavours:
//   * a typed URL (existing field, kept for back-compat + external CDNs)
//   * a file upload (new — uploaded to Supabase Storage under
//     suppliers/<id>/logo-<ts>-<rand>-<name>, path saved to logoUrl).
// The portal/grid renderer already resolves Storage paths via signed URLs
// and external URLs verbatim, so the consumer side needs no changes.
const ALLOWED_LOGO_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif"
]);
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

type LogoUploadInput =
  | { kind: "file"; file: File }
  | { kind: "none" };

function readLogoUpload(formData: FormData): LogoUploadInput | { kind: "error"; error: string } {
  const raw = formData.get("logoFile");
  if (!(raw instanceof File) || raw.size === 0) return { kind: "none" };
  if (!ALLOWED_LOGO_MIMES.has(raw.type)) {
    return { kind: "error", error: "סוג קובץ לא נתמך — חייב להיות PNG/JPG/WEBP/SVG/GIF" };
  }
  if (raw.size > MAX_LOGO_BYTES) {
    return { kind: "error", error: "הקובץ גדול מ-5MB" };
  }
  return { kind: "file", file: raw };
}

async function persistLogoFile(supplierId: string, file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const path = buildSupplierLogoStoragePath(supplierId, file.name);
  await uploadToStorage(buffer, path, file.type);
  return path;
}

export type SupplierFormState = { error: string | null; ok: boolean };
type DeleteResult = { ok: true } | { ok: false; error: string };

// Parse the (type, value) commission pair from a form. PERCENT values are
// validated to live in [0, 100]; FIXED values must be non-negative; either
// can be unset (both null = "use whatever's on the assignment").
function parseCommission(formData: FormData) {
  return validateCommissionPair(
    String(formData.get("defaultCommissionType") || ""),
    String(formData.get("defaultCommissionValue") || "")
  );
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
  // Block 44 — featured supplier toggle ("ספקי זהב").
  const isFeatured = String(formData.get("isFeatured") || "") === "true";
  const marketingDescription =
    String(formData.get("marketingDescription") || "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") || "").trim() || null;
  // Block 30 polish #2 — broad marketplace category. Empty string = "no
  // category" (NULL FK).
  const categoryId = String(formData.get("categoryId") || "").trim() || null;
  // Block 38 — transparency fields surfaced on the portal marketplace card.
  // Free text, both nullable. deliverables stays multi-line ("\n"-separated
  // bullets); priceEstimate is a short single-line copy.
  const deliverables =
    String(formData.get("deliverables") || "").trim() || null;
  const priceEstimate =
    String(formData.get("priceEstimate") || "").trim() || null;
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
    isFeatured,
    marketingDescription,
    logoUrl,
    categoryId,
    deliverables,
    priceEstimate
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

    const logoUpload = readLogoUpload(formData);
    if (logoUpload.kind === "error") return { error: logoUpload.error, ok: false };

    // Insert first to obtain the id, then (if file present) upload + update.
    // Two-phase write: any storage failure after insert leaves the supplier
    // with the typed URL (if any) — never a stale path. Same audit row
    // captures the final state after the upload completes.
    const created = await prisma.supplier.create({
      data: {
        ...fields,
        defaultCommissionType: commission.type,
        defaultCommissionValue: commission.value
          ? new Prisma.Decimal(commission.value)
          : null
      },
      select: { id: true }
    });

    let finalLogoUrl = fields.logoUrl;
    if (logoUpload.kind === "file") {
      try {
        finalLogoUrl = await persistLogoFile(created.id, logoUpload.file);
        await prisma.supplier.update({
          where: { id: created.id },
          data: { logoUrl: finalLogoUrl }
        });
      } catch (e) {
        // Don't roll back the supplier — admins can re-upload from the edit
        // form. Surface the error so they see the upload failed.
        await prisma.$transaction(async (tx) => {
          await logAudit(tx, {
            entityType: AuditEntity.SUPPLIER,
            entityId: created.id,
            action: AuditAction.CREATE,
            newValue: {
              ...fields,
              defaultCommissionType: commission.type,
              defaultCommissionValue: commission.value,
              logoUploadError: e instanceof Error ? e.message : "unknown"
            },
            userId: me.id
          });
        });
        revalidatePath("/suppliers");
        return {
          error: `הספק נשמר, אך העלאת הלוגו נכשלה: ${e instanceof Error ? e.message : "שגיאה"}`,
          ok: false
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: created.id,
        action: AuditAction.CREATE,
        newValue: {
          ...fields,
          logoUrl: finalLogoUrl,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath("/portal/partners");
    revalidatePath("/partners");
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

    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null }
    });
    if (!existing) return { error: "הספק לא נמצא", ok: false };

    const fields = readSupplierForm(formData);
    if (!fields.name) return { error: "שם הספק חובה", ok: false };

    const commission = parseCommission(formData);
    if (!commission.ok) return { error: commission.error, ok: false };

    const logoUpload = readLogoUpload(formData);
    if (logoUpload.kind === "error") return { error: logoUpload.error, ok: false };

    // Edit path: we already have the id so we can upload before the DB
    // write. If upload fails the transaction never runs — supplier stays
    // exactly as it was.
    let finalLogoUrl = fields.logoUrl;
    if (logoUpload.kind === "file") {
      try {
        finalLogoUrl = await persistLogoFile(supplierId, logoUpload.file);
      } catch (e) {
        return {
          error: `העלאת הלוגו נכשלה: ${e instanceof Error ? e.message : "שגיאה"}`,
          ok: false
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          ...fields,
          logoUrl: finalLogoUrl,
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
          isFeatured: existing.isFeatured,
          marketingDescription: existing.marketingDescription,
          logoUrl: existing.logoUrl,
          deliverables: existing.deliverables,
          priceEstimate: existing.priceEstimate
        },
        newValue: {
          ...fields,
          logoUrl: finalLogoUrl,
          defaultCommissionType: commission.type,
          defaultCommissionValue: commission.value
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${supplierId}`);
    revalidatePath("/portal/partners");
    revalidatePath("/partners");
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// Soft-delete a supplier — sets deletedAt and hides them from every listing
// (back-office, marketplace, leads routing, xlsx exports). Existing
// SupplierTaskAssignments stay attached to the row and survive restore
// from /settings/recycle-bin. Permanent deletion happens via the recycle
// bin's "מחק לצמיתות" path, which is blocked if any assignments / docs
// still reference the supplier.
//
// Prior behaviour (until Block 45, June 2026): hard delete + cascade
// removal of every assignment row in the same transaction. We kept the
// confirm() warning on the suppliers page card but the new copy now
// reflects "moves to recycle bin" instead of "irreversible".
export async function deleteSupplier(supplierId: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: {
        id: true,
        name: true,
        _count: { select: { taskAssignments: true } }
      }
    });
    if (!supplier) return { ok: false, error: "הספק לא נמצא או כבר נמחק" };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.supplier.update({
        where: { id: supplierId },
        data: { deletedAt: now }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: supplierId,
        action: AuditAction.DELETE,
        oldValue: { name: supplier.name },
        newValue: {
          softDeletedAt: now.toISOString(),
          attachedAssignments: supplier._count.taskAssignments
        },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    revalidatePath("/finances/supplier-commissions");
    revalidatePath("/portal/partners");
    revalidatePath("/settings/recycle-bin");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת הספק נכשלה"
    };
  }
}
