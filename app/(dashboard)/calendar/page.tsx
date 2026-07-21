import Link from "next/link";
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Unified due-date view across the whole business:
//   - Tasks            (Task.dueDate)
//   - Billing milestones (BillingMilestone.dueDate, permit-level)
//   - Deal milestones  (DealMilestone.dueDate, master-deal level)
//   - Permits          (Permit.expectedCloseDate)
//   - Proposals        (Proposal.expiresAt — V2 only, when status SENT)
//
// Rendered as a month grid, one cell per day, events stacked inside. URL
// param ?month=YYYY-MM (defaults to current month) drives data fetch +
// prev/next buttons.

type EventKind = "task" | "billing" | "deal" | "permit" | "proposal";

type CalendarEvent = {
  kind: EventKind;
  label: string;
  href: string;
  context: string | null;
  // Soft severity:
  //  overdue = past + still pending → red
  //  due-today / due-this-week → amber
  //  done / paid → muted gray
  //  future → neutral
  severity: "overdue" | "soon" | "done" | "future";
};

const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר"
];

const HE_WEEKDAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

function parseMonth(raw: string | undefined): { year: number; month: number } {
  if (raw && /^\d{4}-\d{1,2}$/.test(raw)) {
    const [y, m] = raw.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthKey(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function severityFor(d: Date, done: boolean, today: Date): CalendarEvent["severity"] {
  if (done) return "done";
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (24 * 3600 * 1000));
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "soon";
  return "future";
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const monthRaw = typeof params.month === "string" ? params.month : undefined;
  const { year, month } = parseMonth(monthRaw);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Range for the month — inclusive padding so events on Sundays before the
  // 1st (when month starts mid-week) show up in the leading cells.
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const gridEnd = new Date(monthEnd);
  gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()));

  const [tasks, billing, deals, permits, proposals] = await Promise.all([
    prisma.task.findMany({
      where: {
        deletedAt: null,
        dueDate: { gte: gridStart, lt: gridEnd },
        permit: { deletedAt: null }
      },
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        permit: {
          select: {
            id: true,
            name: true,
            masterDeal: { select: { name: true } }
          }
        }
      }
    }),
    prisma.billingMilestone.findMany({
      where: {
        permit: { deletedAt: null },
        dueDate: { gte: gridStart, lt: gridEnd }
      },
      select: {
        id: true,
        name: true,
        amount: true,
        status: true,
        dueDate: true,
        permit: {
          select: {
            id: true,
            name: true,
            masterDeal: { select: { name: true } }
          }
        }
      }
    }),
    prisma.dealMilestone.findMany({
      where: {
        masterDeal: { deletedAt: null },
        dueDate: { gte: gridStart, lt: gridEnd }
      },
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        dueDate: true,
        masterDeal: { select: { id: true, name: true } }
      }
    }),
    prisma.permit.findMany({
      where: {
        deletedAt: null,
        expectedCloseDate: { gte: gridStart, lt: gridEnd }
      },
      select: {
        id: true,
        name: true,
        status: true,
        expectedCloseDate: true,
        masterDeal: { select: { name: true } }
      }
    }),
    prisma.proposal.findMany({
      where: {
        deletedAt: null,
        templateVersion: { gte: 2 },
        status: "SENT",
        expiresAt: { gte: gridStart, lt: gridEnd }
      },
      select: {
        id: true,
        customerName: true,
        expiresAt: true
      }
    })
  ]);

  // Build day → events map.
  const byDay = new Map<string, CalendarEvent[]>();
  const add = (date: Date, ev: CalendarEvent) => {
    const k = dateKey(date);
    const list = byDay.get(k) ?? [];
    list.push(ev);
    byDay.set(k, list);
  };

  for (const t of tasks) {
    if (!t.dueDate) continue;
    const done = t.status === "COMPLETED";
    add(t.dueDate, {
      kind: "task",
      label: t.name,
      href: `/permits/${t.permit.id}/tasks?focus=${t.id}`,
      context: `${t.permit.masterDeal.name} · ${t.permit.name}`,
      severity: severityFor(t.dueDate, done, today)
    });
  }
  for (const m of billing) {
    if (!m.dueDate) continue;
    const done = m.status === "PAID";
    add(m.dueDate, {
      kind: "billing",
      label: m.name,
      href: `/permits/${m.permit.id}/finances`,
      context: `${m.permit.masterDeal.name} · ${m.permit.name}`,
      severity: severityFor(m.dueDate, done, today)
    });
  }
  for (const m of deals) {
    if (!m.dueDate) continue;
    const done = m.status === "PAID";
    add(m.dueDate, {
      kind: "deal",
      label: m.description,
      href: `/projects/${m.masterDeal.id}`,
      context: m.masterDeal.name,
      severity: severityFor(m.dueDate, done, today)
    });
  }
  for (const p of permits) {
    if (!p.expectedCloseDate) continue;
    const done = p.status === "COMPLETED";
    add(p.expectedCloseDate, {
      kind: "permit",
      label: `סגירת היתר: ${p.name}`,
      href: `/permits/${p.id}`,
      context: p.masterDeal.name,
      severity: severityFor(p.expectedCloseDate, done, today)
    });
  }
  for (const q of proposals) {
    if (!q.expiresAt) continue;
    add(q.expiresAt, {
      kind: "proposal",
      label: `תוקף הצעה: ${q.customerName}`,
      href: `/proposals/${q.id}`,
      context: null,
      severity: severityFor(q.expiresAt, false, today)
    });
  }

  // Build the grid: list of weeks, each a list of days.
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (
    let d = new Date(gridStart);
    d < gridEnd;
    d.setDate(d.getDate() + 1)
  ) {
    cells.push({
      date: new Date(d),
      inMonth: d.getMonth() === month
    });
  }
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const prevMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const nextMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  const todayKey = monthKey(today.getFullYear(), today.getMonth());
  const currentKey = monthKey(year, month);

  // Totals for the header
  let overdueCount = 0;
  let soonCount = 0;
  let totalCount = 0;
  const visibleMonthPrefix = monthKey(year, month);
  for (const [key, list] of byDay.entries()) {
    if (!key.startsWith(visibleMonthPrefix)) continue;
    for (const ev of list) {
      totalCount++;
      if (ev.severity === "overdue") overdueCount++;
      if (ev.severity === "soon") soonCount++;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-5 py-6 text-brand-cream shadow-[0_18px_55px_rgba(31,41,55,0.16)] md:px-8 md:py-8">
        <div aria-hidden className="absolute -start-20 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-cream/80">
              <CalendarDays className="size-3.5 text-primary" /> לוח העבודה
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">{HE_MONTHS[month]} {year}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-brand-cream/72 md:text-base">
              כל מה שמתקרב, מחכה או כבר דורש תשומת לב — מסודר על ציר זמן אחד.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
            <CalendarMetric icon={<CalendarDays className="size-4" />} value={totalCount} label="אירועים" />
            <CalendarMetric icon={<AlertCircle className="size-4" />} value={overdueCount} label="באיחור" danger={overdueCount > 0} />
            <CalendarMetric icon={<Clock3 className="size-4" />} value={soonCount} label="השבוע" />
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/calendar?month=${monthKey(prevMonth.year, prevMonth.month)}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            aria-label="חודש קודם"
          >
            <ChevronRight className="size-3" />
            {HE_MONTHS[prevMonth.month]}
          </Link>
          {currentKey !== todayKey && (
            <Link
              href="/calendar"
              className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            >
              היום
            </Link>
          )}
          <Link
            href={`/calendar?month=${monthKey(nextMonth.year, nextMonth.month)}`}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
            aria-label="חודש הבא"
          >
            {HE_MONTHS[nextMonth.month]}
            <ChevronLeft className="size-3" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="hidden sm:inline">גררו הצידה בנייד כדי לראות את כל השבוע</span>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300">
              <AlertCircle className="size-3" />
              באיחור: <span className="font-semibold tabular-nums">{overdueCount}</span>
            </span>
          )}
          {soonCount > 0 && (
            <span className="text-amber-700 dark:text-amber-300">
              השבוע: <span className="font-semibold tabular-nums">{soonCount}</span>
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/80 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.065)]">
        <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b bg-[#fbfaf7] text-center text-xs font-bold text-muted-foreground">
          {HE_WEEKDAYS.map((wd) => (
            <div key={wd} className="px-2 py-3">
              {wd}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell, idx) => {
            const events = byDay.get(dateKey(cell.date)) ?? [];
            const isToday = dateKey(cell.date) === dateKey(today);
            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[118px] border-b border-l p-2 text-[11px] transition-colors hover:bg-primary/[0.025]",
                  !cell.inMonth && "bg-muted/20 text-muted-foreground",
                  isToday && "bg-primary/[0.055] ring-1 ring-inset ring-primary/25"
                )}
              >
                <div
                  className={cn(
                    "mb-2 flex items-center justify-between text-xs",
                    isToday && "font-bold"
                  )}
                >
                  <span className="tabular-nums">{cell.date.getDate()}</span>
                  {isToday && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-white">
                      היום
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 4).map((ev, i) => (
                    <Link
                      key={i}
                      href={ev.href}
                      className={cn(
                        "block min-h-6 cursor-pointer truncate rounded-md border border-transparent px-1.5 py-1 text-[10px] font-medium leading-tight transition-opacity hover:opacity-75",
                        ev.severity === "overdue" &&
                          "bg-red-500/15 text-red-800 dark:text-red-200",
                        ev.severity === "soon" &&
                          "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                        ev.severity === "done" &&
                          "bg-muted text-muted-foreground line-through",
                        ev.severity === "future" &&
                          "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                      )}
                      title={`${ev.label}${ev.context ? ` · ${ev.context}` : ""}`}
                    >
                      <span aria-hidden className={cn("me-1 inline-block size-1.5 rounded-full", kindDot(ev.kind))} />
                      {ev.label}
                    </Link>
                  ))}
                  {events.length > 4 && (
                    <div className="px-1 text-[9px] text-muted-foreground">
                      +{events.length - 4} נוספים
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white/60 px-3 py-2 text-[11px] text-muted-foreground">
        <Legend swatch="bg-red-500/15" label="באיחור" />
        <Legend swatch="bg-amber-500/15" label="עד שבוע" />
        <Legend swatch="bg-emerald-500/10" label="עתידי" />
        <Legend swatch="bg-muted" label="הושלם / שולם" />
        <span className="ms-auto hidden items-center gap-3 md:inline-flex">
          <KindLegend dot="bg-sky-500" label="משימה" /><KindLegend dot="bg-emerald-500" label="חיוב" /><KindLegend dot="bg-violet-500" label="אבן דרך" /><KindLegend dot="bg-orange-500" label="היתר" /><KindLegend dot="bg-pink-500" label="הצעה" />
        </span>
      </div>
    </section>
  );
}

function kindDot(kind: EventKind): string {
  switch (kind) {
    case "task":
      return "bg-sky-500";
    case "billing":
      return "bg-emerald-500";
    case "deal":
      return "bg-violet-500";
    case "permit":
      return "bg-orange-500";
    case "proposal":
      return "bg-pink-500";
  }
}

function CalendarMetric({ icon, value, label, danger = false }: { icon: React.ReactNode; value: number; label: string; danger?: boolean }) {
  return (
    <div className={danger ? "rounded-2xl border border-red-300/20 bg-red-500/20 p-3" : "rounded-2xl border border-white/10 bg-white/10 p-3"}>
      <div className={danger ? "text-red-200" : "text-brand-cream/60"}>{icon}</div>
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-brand-cream/65">{label}</div>
    </div>
  );
}

function KindLegend({ dot, label }: { dot: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={cn("size-2 rounded-full", dot)} />{label}</span>;
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block size-3 rounded", swatch)} />
      {label}
    </span>
  );
}
