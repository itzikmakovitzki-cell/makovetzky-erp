"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

const MAX_CONTENT_LENGTH = 5000;
const PREVIEW_LENGTH = 60;

function preview(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed;
  return trimmed.slice(0, PREVIEW_LENGTH).trimEnd();
}

export async function createNote(permitId: string, content: string) {
  const user = await getCurrentUser();
  const trimmed = content.trim();
  if (!trimmed) throw new Error("תוכן ההערה חובה");
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    throw new Error(`תוכן ההערה ארוך מ-${MAX_CONTENT_LENGTH} תווים`);
  }

  // Confirm the permit exists — avoids dangling notes if the permitId was tampered with.
  const permit = await prisma.permit.findUnique({ where: { id: permitId }, select: { id: true } });
  if (!permit) throw new Error("היתר לא נמצא");

  await prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        permitId,
        authorId: user.id,
        content: trimmed,
        isPinned: false
      }
    });
    await logAudit(tx, {
      entityType: AuditEntity.NOTE,
      entityId: note.id,
      action: AuditAction.CREATE,
      newValue: {
        permitId,
        contentPreview: preview(trimmed),
        isPinned: false
      },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${permitId}`, "layout");
}

export async function toggleNotePin(noteId: string) {
  const user = await getCurrentUser();
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { id: true, permitId: true, isPinned: true }
  });
  if (!note) throw new Error("הערה לא נמצאה");

  const newPinned = !note.isPinned;

  await prisma.$transaction(async (tx) => {
    await tx.note.update({
      where: { id: noteId },
      data: { isPinned: newPinned }
    });
    await logAudit(tx, {
      entityType: AuditEntity.NOTE,
      entityId: noteId,
      action: AuditAction.UPDATE,
      oldValue: { isPinned: note.isPinned },
      newValue: { isPinned: newPinned },
      userId: user.id
    });
  });

  revalidatePath(`/permits/${note.permitId}`, "layout");
}
