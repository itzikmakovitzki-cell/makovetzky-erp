"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import {
  buildSupplierDocumentStoragePath,
  deleteFromStorage,
  uploadToStorage
} from "@/lib/supabase-storage";

// Block 38 — files attached to a Supplier (service catalog, contract,
// capabilities PDF). ADMIN only — back-office concept; clients and
// contractors don't get to touch supplier metadata. Storage cleanup runs
// inside the same code path as the DB write so an orphan file or row is
// unlikely; if storage fails after DB succeeds we surface the error.

export type SupplierDocumentFormState = { error: string | null; ok: boolean };
type MutationResult = { ok: true } | { ok: false; error: string };

// 25 MB — same ceiling as permit documents (lib/actions/documents.ts).
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function uploadSupplierDocument(
  _prev: SupplierDocumentFormState,
  formData: FormData
): Promise<SupplierDocumentFormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const supplierId = String(formData.get("supplierId") || "").trim();
    if (!supplierId) return { error: "חסר מזהה ספק", ok: false };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "יש לבחור קובץ", ok: false };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        error: `הקובץ גדול מ-${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB`,
        ok: false
      };
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true, name: true }
    });
    if (!supplier) return { error: "הספק לא נמצא", ok: false };

    const description = String(formData.get("description") || "").trim() || null;

    const storagePath = buildSupplierDocumentStoragePath(supplierId, file.name);
    const bytes = await file.arrayBuffer();
    await uploadToStorage(bytes, storagePath, file.type || null);

    await prisma.$transaction(async (tx) => {
      const doc = await tx.supplierDocument.create({
        data: {
          supplierId,
          fileName: file.name,
          fileUrl: storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
          description,
          uploadedById: me.id
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_DOCUMENT,
        entityId: doc.id,
        action: AuditAction.CREATE,
        newValue: {
          supplierId,
          supplierName: supplier.name,
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          description
        },
        userId: me.id
      });
    });

    revalidatePath(`/suppliers`);
    return { error: null, ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "העלאת המסמך נכשלה"
    };
  }
}

export async function deleteSupplierDocument(docId: string): Promise<MutationResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const existing = await prisma.supplierDocument.findUnique({
      where: { id: docId },
      select: {
        id: true,
        supplierId: true,
        fileName: true,
        fileUrl: true
      }
    });
    if (!existing) return { ok: false, error: "המסמך לא נמצא" };

    await prisma.$transaction(async (tx) => {
      await tx.supplierDocument.delete({ where: { id: docId } });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_DOCUMENT,
        entityId: docId,
        action: AuditAction.DELETE,
        oldValue: {
          supplierId: existing.supplierId,
          fileName: existing.fileName
        },
        userId: me.id
      });
    });

    // Storage cleanup outside the DB tx — if it fails, the row is already
    // gone and we leave an orphan blob; that's preferable to keeping a
    // dangling DB row pointing at a missing file. Errors are swallowed
    // to keep the UX clean (admin sees "deleted").
    try {
      await deleteFromStorage(existing.fileUrl);
    } catch {
      // swallow — best effort
    }

    revalidatePath(`/suppliers`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת המסמך נכשלה"
    };
  }
}
