import { AlertTriangle, ListChecks } from "lucide-react";

// Block 25: time-of-day greeting + a glance at today's workload, shown at the
// top of the personal inbox. Greeting/emoji and counts are computed server-side
// (Israel time) so there's no hydration flash.
export function InboxGreeting({
  greeting,
  emoji,
  name,
  todayCount,
  overdueCount
}: {
  greeting: string;
  emoji: string;
  name: string | null;
  todayCount: number;
  overdueCount: number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-brand-navy px-4 py-3 text-brand-navy-foreground shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold">
          {greeting}
          {name ? `, ${name}` : ""} <span aria-hidden>{emoji}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1">
            <ListChecks className="size-3.5" aria-hidden />
            {todayCount} למעקב היום
          </span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/25 px-2 py-1 font-semibold text-red-100">
              <AlertTriangle className="size-3.5" aria-hidden />
              {overdueCount} באיחור
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-brand-navy-foreground/80">
        יש לך היום {todayCount} משימות למעקב, מתוכן {overdueCount} באיחור.
      </p>
    </div>
  );
}
