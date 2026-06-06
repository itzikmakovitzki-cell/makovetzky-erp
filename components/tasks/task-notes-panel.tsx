"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MessageSquarePlus, PencilLine, Trash2, Check, X } from "lucide-react";
import {
  addTaskNote,
  updateTaskNote,
  deleteTaskNote,
  type TaskNoteFormState
} from "@/app/actions/task-notes";
import { formatDateTime } from "@/lib/utils";

// Block 34 — per-task progress notes panel.
//
// Used in three places:
//   * components/permit/task-edit-dialog.tsx  (back-office, full CRUD).
//   * components/permit/tasks-table.tsx       (inline single-row preview).
//   * app/portal/permit/[id]/page.tsx          (portal contractor view).
//
// The `currentUser` prop drives the edit/delete affordances per row:
// staff (ADMIN/EMPLOYEE) can mutate any note; contractors can mutate
// only their own. The server actions re-verify, so this is UI-only gating.

export type TaskNoteItem = {
  id: string;
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  authorId: string | null;
  authorName: string | null;
};

export type TaskNotesViewer = {
  id: string;
  role: "ADMIN" | "EMPLOYEE" | "CONTRACTOR";
};

export function TaskNotesPanel({
  taskId,
  notes,
  viewer,
  emptyHint
}: {
  taskId: string;
  notes: TaskNoteItem[];
  viewer: TaskNotesViewer;
  emptyHint?: string;
}) {
  const initialState: TaskNoteFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(addTaskNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="space-y-2">
      {notes.length === 0 ? (
        <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-center text-[11px] text-muted-foreground">
          {emptyHint ?? "אין הערות עדיין. כתוב את הראשונה למטה."}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <TaskNoteRow key={n.id} note={n} viewer={viewer} />
          ))}
        </ul>
      )}

      <form ref={formRef} action={formAction} className="space-y-1">
        <input type="hidden" name="taskId" value={taskId} />
        <textarea
          name="content"
          rows={2}
          required
          maxLength={2000}
          placeholder='למשל: "שלחתי מייל לאדריכלית, ממתינה לתעודה"'
          className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {state.error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
            {state.error}
          </div>
        )}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-0.5 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <MessageSquarePlus className="size-3" />
            )}
            הוסף הערה
          </button>
        </div>
      </form>
    </div>
  );
}

function canMutate(note: TaskNoteItem, viewer: TaskNotesViewer): boolean {
  if (viewer.role === "ADMIN" || viewer.role === "EMPLOYEE") return true;
  return note.authorId === viewer.id;
}

function TaskNoteRow({
  note,
  viewer
}: {
  note: TaskNoteItem;
  viewer: TaskNotesViewer;
}) {
  const [editing, setEditing] = useState(false);
  const allowed = canMutate(note, viewer);
  const edited = note.updatedAt !== note.createdAt;

  return (
    <li className="rounded border bg-card px-2 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground">
              {note.authorName ?? "משתמש שהוסר"}
            </span>
            <span>·</span>
            <span className="tabular-nums">{formatDateTime(note.createdAt)}</span>
            {edited && <span title="ההערה נערכה">(נערך)</span>}
          </div>
          {editing ? (
            <NoteEditForm
              note={note}
              onDone={() => setEditing(false)}
            />
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-snug">
              {note.content}
            </p>
          )}
        </div>
        {allowed && !editing && (
          <NoteRowActions note={note} onEdit={() => setEditing(true)} />
        )}
      </div>
    </li>
  );
}

function NoteEditForm({
  note,
  onDone
}: {
  note: TaskNoteItem;
  onDone: () => void;
}) {
  const initialState: TaskNoteFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    updateTaskNote,
    initialState
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={formAction} className="mt-1 space-y-1">
      <input type="hidden" name="noteId" value={note.id} />
      <textarea
        name="content"
        defaultValue={note.content}
        rows={2}
        required
        maxLength={2000}
        className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {state.error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={onDone}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
        >
          <X className="size-3" />
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2 py-0.5 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
          שמור
        </button>
      </div>
    </form>
  );
}

function NoteRowActions({
  note,
  onEdit
}: {
  note: TaskNoteItem;
  onEdit: () => void;
}) {
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    if (!window.confirm("למחוק את ההערה? פעולה לא הפיכה.")) return;
    startDelete(async () => {
      const res = await deleteTaskNote(note.id);
      if (!res.ok) window.alert(res.error);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="ערוך הערה"
        title="ערוך"
      >
        <PencilLine className="size-3" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="rounded p-0.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
        aria-label="מחק הערה"
        title="מחק"
      >
        {isDeleting ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
      </button>
    </div>
  );
}
