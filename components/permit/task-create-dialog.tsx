"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Plus, X } from "lucide-react";
import type { TaskPriority, TaskResponsibility } from "@prisma/client";
import { createTask } from "@/app/actions/tasks";
import { TASK_RESPONSIBILITY_LABEL } from "@/lib/status-maps";

// Block 35 — Add a single task to an existing permit.
//
// Mirrors TaskEditDialog field-by-field so users see the same form whether
// they're creating or editing. Kept as a separate component because the
// edit dialog has a different shape (notes panel + 1 hidden taskId + uses
// updateTaskMetadata).

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

export function CreateTaskButton({
  permitId,
  assignees,
  categorySuggestions
}: {
  permitId: string;
  assignees: { id: string; name: string }[];
  categorySuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11.5px] font-medium text-background hover:opacity-90"
      >
        <Plus className="size-3" />
        משימה חדשה
      </button>
      {open && (
        <CreateTaskDialog
          permitId={permitId}
          assignees={assignees}
          categorySuggestions={categorySuggestions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CreateTaskDialog({
  permitId,
  assignees,
  categorySuggestions,
  onClose
}: {
  permitId: string;
  assignees: { id: string; name: string }[];
  categorySuggestions: string[];
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
      const res = await createTask({
        permitId,
        name: String(fd.get("name") || ""),
        description: String(fd.get("description") || "") || null,
        category: String(fd.get("category") || "") || null,
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
      className="w-[520px] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="size-3.5" />
            משימה חדשה
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              שם המשימה <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              required
              autoFocus
              maxLength={200}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תיאור</span>
            <textarea
              name="description"
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
                list="task-create-category-list"
                maxLength={80}
                placeholder='למשל: "שלד"'
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {categorySuggestions.length > 0 && (
                <datalist id="task-create-category-list">
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
                defaultValue=""
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
              placeholder="הפרד תגיות בקו אנכי |"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">עדיפות</span>
              <select
                name="priority"
                defaultValue="NORMAL"
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
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">אחראי</span>
              <select
                name="assigneeId"
                defaultValue=""
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
            צור משימה
          </button>
        </div>
      </form>
    </dialog>
  );
}
