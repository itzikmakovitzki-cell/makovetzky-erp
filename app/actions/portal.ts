"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { buildPermitStoragePath, uploadToStorage } from "@/lib/supabase-storage";
import { assertPortalAccessToPermit } from "@/lib/portal-access";

// Type is internal — "use server" files can only export async functions.
type UploadFormState = { error: string | null; ok: boolean };

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // mirror next.config bodySizeLimit

// Portal-scoped upload. Mirrors uploadDocument from app/actions/documents.ts
// but enforces PortalAccess (instead of admin/employee role) and refuses if
// the parent permit is COMPLETED or soft-deleted.
//
// Documents land in the same Document table as internal uploads — the only
// signal that this came from a portal user is the audit entry (source =
// "portal") and uploadedById pointing to the client/contractor user.
export async function portalUploadDocument(
  _prev: UploadFormState,
  formData: FormData
): Promise<UploadFormState> {
  try {
    const user = await getCurrentUser();
    const permitId = String(formData.get("permitId") || "");
    const taskIdRaw = String(formData.get("taskId") || "").trim();
    const taskId = taskIdRaw || null;
    const file = formData.get("file");
    const note = String(formData.get("note") || "").trim() || null;

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

    // Access check: the user must have PortalAccess for the permit's client
    // (or be an admin previewing). This also confirms the permit exists.
    await assertPortalAccessToPermit({ id: user.id, role: user.role }, permitId);

    // Refuse uploads on completed permits — mirrors the lock applied to
    // internal write actions in app/actions/permits.ts.
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!permit) return { error: "ההיתר לא נמצא", ok: false };
    if (permit.status === "COMPLETED") {
      return {
        error: "ההיתר הושלם וננעל לעריכה. פנה למנהל הפרויקט.",
        ok: false
      };
    }

    // If the upload targets a task, verify it belongs to this permit and is
    // not soft-deleted. Without taskId the document lives at permit level.
    let taskNameForAudit: string | null = null;
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true, permitId: true, name: true }
      });
      if (!task || task.permitId !== permitId) {
        return { error: "המשימה אינה שייכת להיתר", ok: false };
      }
      taskNameForAudit = task.name;
    }

    // Version numbering — match the internal upload + magic-link flows so
    // the documents tab counts revisions consistently.
    let version = 1;
    if (taskId) {
      const max = await prisma.document.aggregate({
        where: { taskId },
        _max: { version: true }
      });
      if (max._max.version) version = max._max.version + 1;
    }

    const storagePath = buildPermitStoragePath(permitId, file.name);
    const bytes = await file.arrayBuffer();
    await uploadToStorage(bytes, storagePath, file.type || null);

    const sourceNote = `הועלה דרך הפורטל ע"י ${user.name || user.email}`;
    const combinedNotes = note ? `${sourceNote} · ${note}` : sourceNote;

    await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          permitId,
          taskId,
          fileName: file.name,
          fileUrl: storagePath,
          mimeType: file.type || null,
          sizeBytes: file.size,
          version,
          isLatestApproved: false,
          uploadedById: user.id,
          notes: combinedNotes
        }
      });

      await logAudit(tx, {
        entityType: AuditEntity.DOCUMENT,
        entityId: doc.id,
        action: AuditAction.CREATE,
        newValue: {
          permitId,
          taskId,
          taskName: taskNameForAudit,
          fileName: file.name,
          version,
          source: "portal",
          uploaderRole: user.role
        },
        userId: user.id
      });
    });

    revalidatePath(`/portal/permit/${permitId}`);
    revalidatePath(`/permits/${permitId}`, "layout");
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה בהעלאת המסמך",
      ok: false
    };
  }
}
