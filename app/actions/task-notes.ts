"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Block 34 — per-task progress notes ("הערות משימה").
//
// Role rules (same pattern as Block 33 ProjectContacts):
//   * ADMIN / EMPLOYEE  — full CRUD on any task's notes.
//   * CONTRACTOR (portal) — INSERT only, scoped by PortalAccess to the
//     permit's client. Edit/delete a note they authored themselves; can't
//     touch anyone else's row.
//
// Every mutation lives inside a single prisma.$transaction + logAudit so
// the note row and the audit entry commit atomically.

export type TaskNoteFormState = { error: string | null; ok: boolean };
type MutationResult = { ok: true } | { ok: false; error: string };

const MAX_NOTE_LENGTH = 2000;

function readContent(formData: FormData): string {
  return String(formData.get("content") || "").trim();
}

function validateContent(content: string): string | null {
  if (!content) return "תוכן ההערה חובה";
  if (content.length > MAX_NOTE_LENGTH) {
    return `הערה ארוכה מדי (מקסימום ${MAX_NOTE_LENGTH} תווים)`;
  }
  return null;
}

// Resolve the task → permit → clientId chain so we can gate CONTRACTOR
// callers via PortalAccess. ADMIN / EMPLOYEE pass through unconditionally.
async function assertCanReadTask(
  user: { id: string; role: string },
  taskId: string
): Promise<{ ok: true; permitId: string } | { ok: false; error: string }> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    select: {
      id: true,
      permitId: true,
      permit: {
        select: { masterDeal: { select: { clientId: true } } }
      }
    }
  });
  if (!task) return { ok: false, error: "המשימה לא נמצאה" };

  if (user.role === "ADMIN" || user.role === "EMPLOYEE") {
    return { ok: true, permitId: task.permitId };
  }
  if (user.role === "CONTRACTOR") {
    const granted = await prisma.portalAccess.findFirst({
      where: { userId: user.id, clientId: task.permit.masterDeal.clientId },
      select: { id: true }
    });
    if (!granted) return { ok: false, error: "אין לך גישה למשימה זו" };
    return { ok: true, permitId: task.permitId };
  }
  return { ok: false, error: "אין הרשאה לפעולה זו" };
}

function revalidateAfter(permitId: string) {
  revalidatePath(`/permits/${permitId}/tasks`);
  revalidatePath(`/portal/permit/${permitId}`);
}

// --- Create -----------------------------------------------------------

export async function addTaskNote(
  _prev: TaskNoteFormState,
  formData: FormData
): Promise<TaskNoteFormState> {
  try {
    const me = await getCurrentUser();
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) return { error: "חסר מזהה משימה", ok: false };

    const access = await assertCanReadTask(me, taskId);
    if (!access.ok) return { error: access.error, ok: false };

    const content = readContent(formData);
    const err = validateContent(content);
    if (err) return { error: err, ok: false };

    await prisma.$transaction(async (tx) => {
      const note = await tx.taskNote.create({
        data: { taskId, content, authorId: me.id }
      });
      await logAudit(tx, {
        entityType: AuditEntity.TASK_NOTE,
        entityId: note.id,
        action: AuditAction.CREATE,
        newValue: {
          taskId,
          content,
          source: me.role === "CONTRACTOR" ? "portal" : "back_office"
        },
        userId: me.id
      });
    });

    revalidateAfter(access.permitId);
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// --- Update -----------------------------------------------------------
// Author may edit their own note; ADMIN / EMPLOYEE may edit any note.

export async function updateTaskNote(
  _prev: TaskNoteFormState,
  formData: FormData
): Promise<TaskNoteFormState> {
  try {
    const me = await getCurrentUser();
    const noteId = String(formData.get("noteId") || "").trim();
    if (!noteId) return { error: "חסר מזהה הערה", ok: false };

    const existing = await prisma.taskNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        taskId: true,
        content: true,
        authorId: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { error: "ההערה לא נמצאה", ok: false };

    const isStaff = me.role === "ADMIN" || me.role === "EMPLOYEE";
    const isAuthor = !!existing.authorId && existing.authorId === me.id;
    if (!isStaff && !isAuthor) {
      return { error: "אין הרשאה לערוך הערה זו", ok: false };
    }

    const content = readContent(formData);
    const err = validateContent(content);
    if (err) return { error: err, ok: false };
    if (content === existing.content) {
      return { error: null, ok: true };
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskNote.update({ where: { id: noteId }, data: { content } });
      await logAudit(tx, {
        entityType: AuditEntity.TASK_NOTE,
        entityId: noteId,
        action: AuditAction.UPDATE,
        oldValue: { content: existing.content },
        newValue: { content },
        userId: me.id
      });
    });

    revalidateAfter(existing.task.permitId);
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// --- Delete -----------------------------------------------------------
// Same actor rules as update.

export async function deleteTaskNote(noteId: string): Promise<MutationResult> {
  try {
    const me = await getCurrentUser();
    const existing = await prisma.taskNote.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        taskId: true,
        content: true,
        authorId: true,
        task: { select: { permitId: true } }
      }
    });
    if (!existing) return { ok: false, error: "ההערה לא נמצאה" };

    const isStaff = me.role === "ADMIN" || me.role === "EMPLOYEE";
    const isAuthor = !!existing.authorId && existing.authorId === me.id;
    if (!isStaff && !isAuthor) {
      return { ok: false, error: "אין הרשאה למחוק הערה זו" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskNote.delete({ where: { id: noteId } });
      await logAudit(tx, {
        entityType: AuditEntity.TASK_NOTE,
        entityId: noteId,
        action: AuditAction.DELETE,
        oldValue: { content: existing.content, taskId: existing.taskId },
        userId: me.id
      });
    });

    revalidateAfter(existing.task.permitId);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת ההערה נכשלה"
    };
  }
}
