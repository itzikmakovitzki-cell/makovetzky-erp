"use client";

import { useTransition } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { updateTaskMetadata } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

/**
 * Excel-style inline assignee cell. Selecting a name fires updateTaskMetadata
 * in the background with a subtle spinner; no dialog, no save button.
 */
export function InlineAssignee({
  taskId,
  assigneeId,
  users,
  className
}: {
  taskId: string;
  assigneeId: string | null;
  users: { id: string; name: string }[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <select
        disabled={pending}
        value={assigneeId ?? ""}
        onChange={(e) => {
          const next = e.target.value || null;
          if (next === (assigneeId ?? null) || (next === null && !assigneeId)) return;
          startTransition(async () => {
            const res = await updateTaskMetadata(taskId, { assigneeId: next });
            if (!res.ok && res.error) window.alert(res.error);
          });
        }}
        className={cn(
          "max-w-[8.5rem] appearance-none truncate rounded border border-input bg-background ps-1.5 pe-4 py-0.5 text-[11px] leading-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
          !assigneeId && "text-muted-foreground",
          pending && "opacity-50"
        )}
        aria-label="שינוי אחראי"
      >
        <option value="">לא משויך</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="pointer-events-none absolute end-0.5 top-1/2 -translate-y-1/2 size-2.5 animate-spin opacity-70" />
      ) : (
        <ChevronDown className="pointer-events-none absolute end-0.5 top-1/2 -translate-y-1/2 size-2.5 opacity-60" />
      )}
    </span>
  );
}
