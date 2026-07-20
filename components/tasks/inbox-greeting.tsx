import { AlertTriangle, CheckCircle2, ListChecks, Sparkles } from "lucide-react";

// Block 25: time-of-day greeting + a glance at today's workload, shown at the
// top of the personal inbox. Greeting/emoji and counts are computed server-side
// (Israel time) so there's no hydration flash.
export function InboxGreeting({
  greeting,
  name,
  todayCount,
  overdueCount,
  visibleCount
}: {
  greeting: string;
  name: string | null;
  todayCount: number;
  overdueCount: number;
  visibleCount: number;
}) {
  const firstName = name?.split(" ")[0] ?? "";
  const isClear = todayCount === 0 && overdueCount === 0;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-5 py-6 text-brand-cream shadow-[0_18px_55px_rgba(31,41,55,0.16)] md:px-8 md:py-8">
      <div aria-hidden className="absolute -start-20 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-cream/80">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            מרחב העבודה האישי שלך
          </div>
          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-3 text-sm leading-6 text-brand-cream/72 md:text-base">
            {isClear
              ? "אין שום דבר בוער. אפשר לבחור משימה אחת שתעשה לך סדר בראש ולהתקדם איתה."
              : overdueCount > 0
                ? `נתחיל ב-${overdueCount} שבאיחור, ואז היום כבר ירגיש הרבה יותר קל.`
                : `יש ${todayCount} משימות למעקב היום. אחת בכל פעם — וסוגרים את היום בראש שקט.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
          <Metric icon={<ListChecks className="size-4" />} value={todayCount} label="להיום" />
          <Metric icon={<AlertTriangle className="size-4" />} value={overdueCount} label="באיחור" danger={overdueCount > 0} />
          <Metric icon={<CheckCircle2 className="size-4" />} value={visibleCount} label="מוצגות" />
        </div>
      </div>
    </div>
  );
}

function Metric({ icon, value, label, danger = false }: { icon: React.ReactNode; value: number; label: string; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-300/20 bg-red-500/20 p-3" : "rounded-2xl border border-white/10 bg-white/10 p-3"}>
      <div className={danger ? "text-red-200" : "text-brand-cream/60"}>{icon}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-brand-cream/65">{label}</div>
    </div>
  );
}
