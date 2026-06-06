"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquare, MessageSquarePlus, Plus, X } from "lucide-react";
import {
  TaskNotesPanel,
  type TaskNoteItem,
  type TaskNotesViewer
} from "@/components/tasks/task-notes-panel";
import { formatDateTime } from "@/lib/utils";

// Block 36 — quick notes editor accessible directly from a task row.
//
// Previously the only way to add a note was via the full TaskEditDialog;
// users were opening the heavy "edit task" form just to type "sent email,
// waiting". This component is a lightweight, centered dialog showing ONLY
// the notes panel for one task — same TaskNotesPanel used inside the edit
// dialog and the portal, so the UX is consistent and behaviour is shared.

export function TaskQuickNotesTrigger({
  taskId,
  taskName,
  notes,
  viewer
}: {
  taskId: string;
  taskName: string;
  notes: TaskNoteItem[];
  viewer: TaskNotesViewer;
}) {
  const [open, setOpen] = useState(false);
  const latest = notes[0] ?? null;
  const hasNotes = notes.length > 0;

  return (
    <>
      {hasNotes ? (
        // Existing notes — make the inline preview itself a click target so
        // the user can dive straight into editing without hunting for a +.
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-start gap-1 rounded text-start text-[10px] text-muted-foreground hover:bg-muted/40"
          title="ערוך הערות"
        >
          <MessageSquare className="size-3 shrink-0 translate-y-[1px]" />
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground/80">
                {latest!.authorName ?? "—"}
              </span>
              <span>·</span>
              <span className="tabular-nums">{formatDateTime(latest!.createdAt)}</span>
              {notes.length > 1 && (
                <span className="rounded bg-muted px-1 text-[9px]">+{notes.length - 1}</span>
              )}
            </div>
            <div className="truncate" title={latest!.content}>{latest!.content}</div>
          </div>
        </button>
      ) : (
        // No notes yet — render a compact ghost button so the affordance is
        // visible without bloating empty rows.
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-muted-foreground/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground"
          title="הוסף הערה"
        >
          <Plus className="size-2.5" />
          הערה
        </button>
      )}

      {open && (
        <QuickNotesDialog
          taskId={taskId}
          taskName={taskName}
          notes={notes}
          viewer={viewer}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function QuickNotesDialog({
  taskId,
  taskName,
  notes,
  viewer,
  onClose
}: {
  taskId: string;
  taskName: string;
  notes: TaskNoteItem[];
  viewer: TaskNotesViewer;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="fixed top-1/2 -translate-y-1/2 mx-auto w-[480px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="flex items-start justify-between border-b bg-muted/30 px-3 py-1.5">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <MessageSquarePlus className="size-3.5" />
            הערות משימה
          </h2>
          <p className="truncate text-[10.5px] text-muted-foreground" title={taskName}>
            {taskName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="סגור"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="px-3 py-3">
        <TaskNotesPanel taskId={taskId} notes={notes} viewer={viewer} />
      </div>
    </dialog>
  );
}
