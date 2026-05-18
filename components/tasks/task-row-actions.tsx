"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Star, StarOff, Trash2, Loader2 } from "lucide-react";
import type { TaskPriority, TaskResponsibility } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet } from "@/components/ui/sheet";
import {
  deleteTask,
  toggleTaskSpotlight,
  updateTaskMetadata
} from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

type AssigneeOption = { id: string; name: string };

export type TaskRowActionsTask = {
  id: string;
  name: string;
  dueDate: Date | string | null;
  priority: TaskPriority;
  assigneeId: string | null;
  responsibility: TaskResponsibility | null;
  category: string | null;
  isSpotlight: boolean;
};

export function TaskRowActions({
  task,
  users
}: {
  task: TaskRowActionsTask;
  users: AssigneeOption[];
}) {
  const [editOpen, setEditOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu align="end">
        <DropdownMenuTrigger
          ref={triggerRef}
          className="size-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="פעולות נוספות"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[12rem]">
          <DropdownMenuItem
            icon={<Pencil className="size-3.5" />}
            onSelect={() => setEditOpen(true)}
          >
            ערוך משימה
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={
              task.isSpotlight ? (
                <StarOff className="size-3.5" />
              ) : (
                <Star className="size-3.5" />
              )
            }
            onSelect={() => {
              void toggleTaskSpotlight(task.id);
            }}
          >
            {task.isSpotlight ? "הסר זרקור" : "סמן בזרקור"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            icon={<Trash2 className="size-3.5" />}
            onSelect={() => {
              if (!window.confirm(`למחוק את המשימה "${task.name}"?`)) return;
              void deleteTask(task.id).catch((err: unknown) => {
                window.alert(err instanceof Error ? err.message : "מחיקה נכשלה");
              });
            }}
          >
            מחק משימה
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TaskEditSheet
        task={task}
        users={users}
        open={editOpen}
        onOpenChange={setEditOpen}
        returnFocusRef={triggerRef}
      />
    </>
  );
}

function toDateInputValue(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function TaskEditSheet({
  task,
  users,
  open,
  onOpenChange,
  returnFocusRef
}: {
  task: TaskRowActionsTask;
  users: AssigneeOption[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  returnFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(task.name);
  const [dueDate, setDueDate] = React.useState(toDateInputValue(task.dueDate));
  const [priority, setPriority] = React.useState<TaskPriority>(task.priority);
  const [assigneeId, setAssigneeId] = React.useState(task.assigneeId ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset local form state whenever the sheet opens with a different task —
  // important because the parent component is reused across rows in the table.
  React.useEffect(() => {
    if (!open) return;
    setName(task.name);
    setDueDate(toDateInputValue(task.dueDate));
    setPriority(task.priority);
    setAssigneeId(task.assigneeId ?? "");
    setError(null);
  }, [open, task.id, task.name, task.dueDate, task.priority, task.assigneeId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await updateTaskMetadata(task.id, {
        name,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        assigneeId: assigneeId || null
      });
      if (!result.ok) {
        setError(result.error ?? "שמירה נכשלה");
        return;
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="עריכת משימה"
      side="end"
      returnFocusRef={returnFocusRef}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-4 px-4 py-3">
          <Field label="שם המשימה" htmlFor="task-name">
            <input
              id="task-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              dir="rtl"
            />
          </Field>
          <Field label="תאריך יעד" htmlFor="task-due">
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="עדיפות" htmlFor="task-priority">
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={inputClass}
              dir="rtl"
            >
              <option value="NORMAL">רגיל</option>
              <option value="URGENT">דחוף</option>
            </select>
          </Field>
          <Field label="אחראי" htmlFor="task-assignee">
            <select
              id="task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputClass}
              dir="rtl"
            >
              <option value="">לא משויך</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          {task.responsibility && (
            <div className="text-[11px] text-muted-foreground">
              אחריות: {task.responsibility} · קטגוריה: {task.category ?? "—"} ·
              שדות נוספים זמינים בעמוד המשימה.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background shadow-sm transition-all hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            שמור שינויים
          </button>
        </div>
      </div>
    </Sheet>
  );
}

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  htmlFor,
  children
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
