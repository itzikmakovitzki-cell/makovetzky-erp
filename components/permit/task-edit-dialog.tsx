"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import type { TaskPriority, TaskResponsibility } from "@prisma/client";
import { updateTaskMetadata } from "@/app/actions/tasks";
import { TASK_RESPONSIBILITY_LABEL } from "@/lib/status-maps";
import {
  TaskNotesPanel,
  type TaskNoteItem,
  type TaskNotesViewer
} from "@/components/tasks/task-notes-panel";

const RESPONSIBILITY_OPTIONS: TaskResponsibility[] = [
  "INTERNAL",
  "CLIENT",
  "CONTRACTOR",
  "AUTHORITY"
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "NORMAL", label: "רגיל" },
  { value: "URGENT", label: "דחוף" }
];

export type TaskEditableValues = {
  id: string;
  name: string;
  description: string;
  category: string;
  responsibility: TaskResponsibility | "";
  tags: string[];
  dueDate: string; // yyyy-mm-dd
  priority: TaskPriority;
  assigneeId: string | "";
};

function parseTagInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split("|")) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export function TaskEditButton({
  task,
  assignees,
  categorySuggestions,
  notes,
  viewer
}: {
  task: TaskEditableValues;
  assignees: { id: string; name: string }[];
  categorySuggestions: string[];
  notes: TaskNoteItem[];
  viewer: TaskNotesViewer;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ערוך משימה"
        aria-label="ערוך משימה"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-3" />
      </button>
      {open && (
        <TaskEditDialog
          key={`edit-${task.id}`}
          task={task}
          assignees={assignees}
          categorySuggestions={categorySuggestions}
          notes={notes}
          viewer={viewer}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TaskEditDialog({
  task,
  assignees,
  categorySuggestions,
  notes,
  viewer,
  onClose
}: {
  task: TaskEditableValues;
  assignees: { id: string; name: string }[];
  categorySuggestions: string[];
  notes: TaskNoteItem[];
  viewer: TaskNotesViewer;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const respRaw = String(fd.get("responsibility") || "");
    const dueRaw = String(fd.get("dueDate") || "").trim();
    const assigneeRaw = String(fd.get("assigneeId") || "");

    startTransition(async () => {
      const res = await updateTaskMetadata(task.id, {
        name: String(fd.get("name") || ""),
        description: String(fd.get("description") || ""),
        category: String(fd.get("category") || ""),
        responsibility: respRaw ? (respRaw as TaskResponsibility) : null,
        tags: parseTagInput(String(fd.get("tags") || "")),
        dueDate: dueRaw ? new Date(dueRaw) : null,
        priority: String(fd.get("priority") || "NORMAL") as TaskPriority,
        assigneeId: assigneeRaw || null
      });
      if (!res.ok) {
        setError(res.error || "שגיאה לא צפויה");
        return;
      }
      dialogRef.current?.close();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="fixed top-1/2 -translate-y-1/2 mx-auto w-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-sm font-semibold">עריכת משימה</h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="סגור"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Metadata form — kept separate so the notes panel below can host
          its own server-action forms (HTML disallows nested <form>). */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-3 px-3 py-3">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              שם המשימה <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              defaultValue={task.name}
              required
              maxLength={200}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תיאור</span>
            <textarea
              name="description"
              defaultValue={task.description}
              rows={2}
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">קטגוריה</span>
              <input
                type="text"
                name="category"
                defaultValue={task.category}
                list="task-edit-category-list"
                maxLength={80}
                placeholder='למשל: "שלד"'
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {categorySuggestions.length > 0 && (
                <datalist id="task-edit-category-list">
                  {categorySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">אחריות</span>
              <select
                name="responsibility"
                defaultValue={task.responsibility}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— ללא —</option>
                {RESPONSIBILITY_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {TASK_RESPONSIBILITY_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תגיות</span>
            <input
              type="text"
              name="tags"
              defaultValue={task.tags.join("|")}
              placeholder="הפרד תגיות בקו אנכי |"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">עדיפות</span>
              <select
                name="priority"
                defaultValue={task.priority}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">תאריך יעד</span>
              <input
                type="date"
                name="dueDate"
                defaultValue={task.dueDate}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">אחראי</span>
              <select
                name="assigneeId"
                defaultValue={task.assigneeId}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— לא משויך —</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isPending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שמור
          </button>
        </div>
      </form>

      {/* Block 34 — progress notes log. Outside the metadata <form> so the
          panel's own server-action forms aren't nested (invalid HTML). */}
      <div className="border-t bg-muted/10 px-3 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            הערות משימה
          </h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {notes.length}
          </span>
        </div>
        <TaskNotesPanel taskId={task.id} notes={notes} viewer={viewer} />
      </div>
    </dialog>
  );
}
