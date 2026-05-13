"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Type is internal — "use server" files can only export async functions.
type AssignFormState = { error: string | null; ok: boolean };

export async function assignPendingDocument(
  _prev: AssignFormState,
  formData: FormData
): Promise<AssignFormState> {
  try {
    const user = await getCurrentUser();
    const pendingDocId = String(formData.get("pendingDocId") || "");
    const permitId = String(formData.get("permitId") || "");
    const taskIdRaw = String(formData.get("taskId") || "").trim();
    const taskId = taskIdRaw || null;
    const buildingIdRaw = String(formData.get("buildingId") || "").trim();
    const buildingId = buildingIdRaw || null;
    const adminNotes = String(formData.get("notes") || "").trim() || null;

    if (!pendingDocId) return { error: "חסר מזהה מסמך נכנס", ok: false };
    if (!permitId) return { error: "יש לבחור היתר", ok: false };

    const pending = await prisma.pendingDocument.findUnique({
      where: { id: pendingDocId },
      select: {
        id: true,
        status: true,
        fileName: true,
        fileUrl: true,
        mimeType: true,
        sourceChannel: true,
        senderInfo: true
      }
    });
    if (!pending) return { error: "מסמך נכנס לא נמצא", ok: false };
    if (pending.status !== "PENDING") {
      return { error: "המסמך כבר טופל בעבר", ok: false };
    }

    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true }
    });
    if (!permit) return { error: "ההיתר לא נמצא", ok: false };

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

    const fileName = pending.fileName ?? "incoming-document";
    const now = new Date();
    const sourceNote = `התקבל מ-${pending.sourceChannel}` +
      (pending.senderInfo ? ` (${pending.senderInfo})` : "");
    const combinedNotes = [sourceNote, adminNotes].filter(Boolean).join(" · ");

    await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          permitId,
          taskId,
          buildingId,
          fileName,
          fileUrl: pending.fileUrl,
          mimeType: pending.mimeType,
          version,
          isLatestApproved: false,
          uploadedById: user.id,
          notes: combinedNotes
        }
      });

      await logAudit(tx, {
        entityType: AuditEntity.DOCUMENT,
        entityId: document.id,
        action: AuditAction.CREATE,
        newValue: {
          permitId,
          fileName,
          version,
          taskId,
          taskName,
          buildingId,
          buildingLabel,
          fromPendingDocId: pendingDocId,
          source: pending.sourceChannel,
          isLatestApproved: false
        },
        userId: user.id
      });

      await tx.pendingDocument.update({
        where: { id: pendingDocId },
        data: {
          status: "ASSIGNED",
          assignedTaskId: taskId,
          assignedPermitId: permitId,
          processedAt: now
        }
      });

      await logAudit(tx, {
        entityType: AuditEntity.PENDING_DOCUMENT,
        entityId: pendingDocId,
        action: AuditAction.ASSIGN,
        newValue: {
          permitId,
          taskId,
          taskName,
          buildingId,
          buildingLabel,
          documentId: document.id,
          fileName,
          source: pending.sourceChannel
        },
        userId: user.id
      });
    });

    revalidatePath("/inbox");
    revalidatePath(`/permits/${permitId}`, "layout");
    return { error: null, ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה בשיוך המסמך",
      ok: false
    };
  }
}

export async function rejectPendingDocument(
  pendingDocId: string,
  reason: string
): Promise<void> {
  const user = await getCurrentUser();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("סיבת דחייה חובה");

  const pending = await prisma.pendingDocument.findUnique({
    where: { id: pendingDocId },
    select: {
      id: true,
      status: true,
      fileName: true,
      sourceChannel: true,
      senderInfo: true
    }
  });
  if (!pending) throw new Error("מסמך נכנס לא נמצא");
  if (pending.status !== "PENDING") throw new Error("המסמך כבר טופל בעבר");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pendingDocument.update({
      where: { id: pendingDocId },
      data: {
        status: "REJECTED",
        rejectionReason: trimmed,
        processedAt: now
      }
    });
    await logAudit(tx, {
      entityType: AuditEntity.PENDING_DOCUMENT,
      entityId: pendingDocId,
      action: AuditAction.REJECT,
      newValue: {
        rejectionReason: trimmed,
        fileName: pending.fileName,
        source: pending.sourceChannel,
        senderInfo: pending.senderInfo
      },
      userId: user.id
    });
  });

  revalidatePath("/inbox");
}
