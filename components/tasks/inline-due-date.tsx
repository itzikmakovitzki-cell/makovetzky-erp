"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { updateTaskMetadata } from "@/app/actions/tasks";
import { cn, formatDate } from "@/lib/utils";

/**
 * Excel-style inline due-date cell. Click the date to reveal a native date
 * picker; picking a value (or clearing it) fires updateTaskMetadata in the
 * background with a subtle spinner. `value` is the ISO date part (YYYY-MM-DD).
 */
export function InlineDueDate({
  taskId,
  value,
  isOverdue,
  frozen,
  className
}: {
  taskId: string;
  value: string | null;
  isOverdue?: boolean;
  frozen?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const next = raw ? raw : null;
    setEditing(false);
    if (next === (value ?? null)) return;
    startTransition(async () => {
      const res = await updateTaskMetadata(taskId, {
        dueDate: next ? new Date(`${next}T00:00:00`) : null
      });
      if (!res.ok && res.error) window.alert(res.error);
    });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        defaultValue={value ?? ""}
        autoFocus
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        className="w-[8.5rem] rounded border border-input bg-background px-1.5 py-0.5 text-[11px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="עריכת תאריך יעד"
      />
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1 rounded border border-transparent px-1 py-0.5 text-xs tabular-nums hover:border-input hover:bg-accent",
        isOverdue && "font-semibold text-red-600",
        frozen && "text-amber-700",
        !value && "text-muted-foreground",
        pending && "opacity-50",
        className
      )}
      aria-label="עריכת תאריך יעד"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <CalendarDays className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
      <span>{value ? formatDate(value) : "קבע תאריך"}</span>
      {isOverdue && <span className="text-[10px]">איחור</span>}
    </button>
  );
}
