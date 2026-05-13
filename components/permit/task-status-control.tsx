"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { updateTaskStatus } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABEL } from "@/lib/status-maps";

const STATUS_ORDER: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
];

// Same color logic as the read-only Badge, but applied to a <select> so the
// status pill is the edit affordance — Excel-style inline-editable cell.
function statusClass(status: TaskStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "AWAITING_AUTHORITY":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "COMPLETED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "BLOCKED":
      return "border-foreground/15 bg-foreground/5 text-muted-foreground";
    case "OPEN":
    default:
      return "border-foreground/30 bg-background text-foreground";
  }
}

export function TaskStatusControl({
  taskId,
  currentStatus
}: {
  taskId: string;
  currentStatus: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <span className={cn("relative inline-flex items-center", pending && "opacity-50")}>
      <select
        disabled={pending}
        value={currentStatus}
        onChange={(e) => {
          const next = e.target.value as TaskStatus;
          if (next === currentStatus) return;
          startTransition(() => {
            void updateTaskStatus(taskId, next);
          });
        }}
        className={cn(
          "appearance-none rounded border ps-1.5 pe-4 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
          statusClass(currentStatus)
        )}
        aria-label="שינוי סטטוס משימה"
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-0.5 top-1/2 -translate-y-1/2 size-2.5 opacity-60" />
    </span>
  );
}
