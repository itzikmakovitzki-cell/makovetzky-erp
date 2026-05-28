import { CalendarDays } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { DueState } from "./my-tasks-types";

// Read-only due-date pill: Red = overdue, Yellow = due today, Gray = future.
export function DueBadge({
  date,
  state,
  className
}: {
  date: string | null;
  state: DueState;
  className?: string;
}) {
  if (!date) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded border border-dashed border-input px-1.5 py-0.5 text-[10px] text-muted-foreground",
          className
        )}
      >
        <CalendarDays className="size-2.5" />
        ללא תאריך
      </span>
    );
  }
  const tone =
    state === "overdue"
      ? "border-red-500/40 bg-red-500/10 text-red-700"
      : state === "today"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : "border-foreground/15 bg-foreground/5 text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        tone,
        className
      )}
    >
      <CalendarDays className="size-2.5" />
      {formatDate(date)}
      {state === "overdue" && " · איחור"}
      {state === "today" && " · היום"}
    </span>
  );
}
