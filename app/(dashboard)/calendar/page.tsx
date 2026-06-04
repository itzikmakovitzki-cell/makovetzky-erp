import Link from "next/link";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/global/page-header";
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
  for (const list of byDay.values()) {
    for (const ev of list) {
      if (!cells.find((c) => c.inMonth && dateKey(c.date) === dateKey(ev.kind === "permit" ? monthStart : monthStart))) {
        // (placeholder; we just count below)
      }
      totalCount++;
      if (ev.severity === "overdue") overdueCount++;
      if (ev.severity === "soon") soonCount++;
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="לוח שנה"
        accent={`${HE_MONTHS[month]} ${year}`}
        description="כל מועדי היעד במערכת במבט אחד — משימות, חיובי כספים, סגירות היתרים, ותוקפי הצעות."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Link
            href={`/calendar?month=${monthKey(prevMonth.year, prevMonth.month)}`}
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
            aria-label="חודש קודם"
          >
            <ChevronRight className="size-3" />
            {HE_MONTHS[prevMonth.month]}
          </Link>
          {currentKey !== todayKey && (
            <Link
              href="/calendar"
              className="inline-flex items-center rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
            >
              היום
            </Link>
          )}
          <Link
            href={`/calendar?month=${monthKey(nextMonth.year, nextMonth.month)}`}
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
            aria-label="חודש הבא"
          >
            {HE_MONTHS[nextMonth.month]}
            <ChevronLeft className="size-3" />
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            סה״כ אירועים: <span className="font-semibold text-foreground tabular-nums">{totalCount}</span>
          </span>
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

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {HE_WEEKDAYS.map((wd) => (
            <div key={wd} className="px-1 py-1.5">
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
                  "min-h-[96px] border-b border-l p-1.5 text-[10.5px]",
                  !cell.inMonth && "bg-muted/20 text-muted-foreground",
                  isToday && "bg-amber-50/60 dark:bg-amber-500/5"
                )}
              >
                <div
                  className={cn(
                    "mb-1 flex items-center justify-between text-[11px]",
                    isToday && "font-bold"
                  )}
                >
                  <span className="tabular-nums">{cell.date.getDate()}</span>
                  {isToday && (
                    <span className="rounded-full bg-amber-500/20 px-1 text-[9px] font-medium text-amber-800 dark:text-amber-200">
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
                        "block truncate rounded px-1 py-0.5 text-[10px] leading-tight hover:opacity-80",
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
                      <span className="me-1 text-[9px]">{kindGlyph(ev.kind)}</span>
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

      <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-muted-foreground">
        <Legend swatch="bg-red-500/15" label="באיחור" />
        <Legend swatch="bg-amber-500/15" label="עד שבוע" />
        <Legend swatch="bg-emerald-500/10" label="עתידי" />
        <Legend swatch="bg-muted" label="הושלם / שולם" />
        <span className="ms-auto">
          📋 משימה · 💰 חיוב · 🏆 אבן דרך · 📄 היתר · ✍️ הצעה
        </span>
      </div>
    </section>
  );
}

function kindGlyph(kind: EventKind): string {
  switch (kind) {
    case "task":
      return "📋";
    case "billing":
      return "💰";
    case "deal":
      return "🏆";
    case "permit":
      return "📄";
    case "proposal":
      return "✍️";
  }
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block size-3 rounded", swatch)} />
      {label}
    </span>
  );
}
