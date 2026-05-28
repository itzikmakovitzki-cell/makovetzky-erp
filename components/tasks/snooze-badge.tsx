import { AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

// Tiny red flag showing how many times a task's due date slipped via Snooze
// (Block 25). Pure presentational so it can render inside server tables/cards.
export function SnoozeBadge({
  count,
  className
}: {
  count: number;
  className?: string;
}) {
  if (!count || count < 1) return null;
  const label = count === 1 ? "נדחה פעם אחת" : `נדחה ${count} פעמים`;
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1 py-0 text-[9px] font-semibold text-red-600",
        className
      )}
    >
      <AlarmClock className="size-2.5" aria-hidden />
      {label}
    </span>
  );
}
