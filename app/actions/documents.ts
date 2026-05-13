"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { buildPermitStoragePath, uploadToStorage } from "@/lib/supabase-storage";

// Type is internal — "use server" files can only export async functions.
type UploadFormState = { error: string | null; ok: boolean };

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // mirror next.config bodySizeLimit

export async function uploadDocument(
  _prev: UploadFormState,
  formData: FormData
): Promise<UploadFormState> {
  try {
    const user = await getCurrentUser();
    const permitId = String(formData.get("permitId") || "");
    const file = formData.get("file");
    const taskIdRaw = String(formData.get("taskId") || "").trim();
    const taskId = taskIdRaw || null;
    const buildingIdRaw = String(formData.get("buildingId") || "").trim();
    const buildingId = buildingIdRaw || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!permitId) return { error: "חסר מזהה היתר", ok: false };
    if (!(file instanceof File) || file.size === 0) {
      return { error: "יש לבחור קובץ", ok: false };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        error: `הקובץ גדול מ-${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} MB`,
        ok: false
      };
    }

    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true }
    });
    if (!permit) return { error: "היתר לא נמצא", ok: false };

    let taskName: string | null = null;
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true, name: true, permitId: true }
      });
      if (!task || task.permitId !== permitId) {
        return { error: "המשימה אינה שייכת להיתר", ok: false };
      }
      taskName = task.name;
    }

    let buildingLabel: string | null = null;
    if (buildingId) {
      const building = await prisma.building.findUnique({
        where: { id: buildingId },
        select: { id: true, label: true, permitId: true }
      });
      if (!building || building.permitId !== permitId) {
        return { error: "היחידה אינה שייכת להיתר", ok: false };
      }
      buildingLabel = building.label;
    }

    let version = 1;
    if (taskId) {
      const max = await prisma.document.aggregate({
        where: { taskId },
        _max: { version: true }
      });
      if (max._max.version) version = max._max.version + 1;
    }

    // Upload to real storage; the path lives in fileUrl. Signed URLs are
    // generated at render time so they don't get stale in the DB.
    const storagePath = buildPermitStoragePath(permitId, file.name);
    const bytes = await file.arrayBuffer();
    await uploadToStorage(bytes, storagePath, file.type || null);

    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          permitId,
          taskId,
          buildingId,
          fileName: file.name,
          fileUrl: storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
          version,
          isLatestApproved: false,
          uploadedById: user.id,
          notes
        }
      });

      await logAudit(tx, {
        entityType: AuditEntity.DOCUMENT,
        entityId: document.id,
        action: AuditAction.CREATE,
        newValue: {
          permitId,
          fileName: file.name,
          version,
          taskId,
          taskName,
          buildingId,
          buildingLabel,
          storagePath,
          sizeBytes: file.size,
          isLatestApproved: false
        },
        userId: user.id
      });
    });

    revalidatePath(`/permits/${permitId}`, "layout");
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה בהעלאת המסמך",
      ok: false
    };
  }
}

export async function approveDocument(documentId: string): Promise<void> {
  const user = await getCurrentUser();
  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: {
      id: true,
      permitId: true,
      taskId: true,
      fileName: true,
      version: true,
      isLatestApproved: true,
      approvedById: true
    }
  });
  if (!doc) throw new Error("מסמך לא נמצא");
  if (doc.approvedById) throw new Error("המסמך כבר אושר");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    let supersededCount = 0;
    if (doc.taskId) {
      const result = await tx.document.updateMany({
        where: {
          taskId: doc.taskId,
          id: { not: documentId },
          isLatestApproved: true
        },
        data: { isLatestApproved: false }
      });
      supersededCount = result.count;
    }

    await tx.document.update({
      where: { id: documentId },
      data: {
        isLatestApproved: true,
        approvedById: user.id,
        approvedAt: now
      }
    });

    await logAudit(tx, {
      entityType: AuditEntity.DOCUMENT,
      entityId: documentId,
      action: AuditAction.APPROVE,
      oldValue: { isLatestApproved: false, approvedById: null },
      newValue: {
        isLatestApproved: true,
        approvedById: user.id,
        approvedAt: now.toISOString(),
        fileName: doc.fileName,
        version: doc.version,
        supersededCount
      },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${doc.permitId}`, "layout");
}

// Soft-delete: leaf operation — always allowed. If this was the
// `isLatestApproved` row, the flag stays on the soft-deleted record so a
// later restore brings the approval back unchanged.
export async function deleteDocument(documentId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const doc = await prisma.document.findFirst({
    where: { id: documentId, deletedAt: null },
    select: { id: true, permitId: true, fileName: true, version: true }
  });
  if (!doc) throw new Error("מסמך לא נמצא");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: documentId },
      data: { deletedAt: now }
    });
    await logAudit(tx, {
      entityType: AuditEntity.DOCUMENT,
      entityId: documentId,
      action: AuditAction.DELETE,
      oldValue: { fileName: doc.fileName, version: doc.version },
      newValue: { softDeletedAt: now.toISOString() },
      userId: me.id
    });
  });

  revalidatePath(`/permits/${doc.permitId}`, "layout");
  revalidatePath("/settings/recycle-bin");
}
