"use client";

import * as React from "react";
import type { TaskPriority, TaskResponsibility, TaskStatus } from "@prisma/client";
import { TASK_RESPONSIBILITY_LABEL, TASK_STATUS_LABEL } from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GanttTask = {
  id: string;
  name: string;
  category: string | null;
  responsibility: TaskResponsibility | null;
  status: TaskStatus;
  priority: TaskPriority;
  frozen: boolean;
  isSpotlight: boolean;
  startDate: string | null; // ISO
  dueDate: string | null; // ISO
  assigneeName: string | null;
  hasUnmetDeps: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;
const DAY_PX = 28; // one calendar day = 28px on the timeline track
const LEFT_COL_PX = 224; // sticky-left task-name column
const ROW_HEIGHT_PX = 40;
const HEADER_HEIGHT_PX = 56;
const NO_CATEGORY_LABEL = "ללא סיווג";

// Months in Hebrew for the timeline header.
const MONTH_HE = [
  "ינו׳",
  "פבר׳",
  "מרץ",
  "אפר׳",
  "מאי",
  "יוני",
  "יולי",
  "אוג׳",
  "ספט׳",
  "אוק׳",
  "נוב׳",
  "דצמ׳"
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function diffDays(a: Date, b: Date): number {
  // a - b, in whole days (a >= b expected for positive value)
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
}

// Resolve the visible bar range for a task. Returns [start, end] both inclusive,
// or null if the task has no dates at all (rendered in a separate "no date" lane).
function resolveTaskRange(t: GanttTask): [Date, Date] | null {
  const s = t.startDate ? new Date(t.startDate) : null;
  const d = t.dueDate ? new Date(t.dueDate) : null;
  if (!s && !d) return null;
  if (s && d) return [startOfDay(s), startOfDay(d)];
  // Fallback when only one side is set: render a 3-day window so the bar is visible.
  if (s) return [startOfDay(s), startOfDay(addDays(s, 3))];
  return [startOfDay(addDays(d as Date, -3)), startOfDay(d as Date)];
}

// Color matches the existing legend on the table view exactly — red overdue,
// amber awaiting-authority/frozen, zinc blocked, emerald complete, sky
// in-progress, slate otherwise.
function barColorFor(t: GanttTask, now: Date): string {
  if (t.status === "COMPLETED") return "bg-emerald-500";
  if (t.frozen || t.status === "AWAITING_AUTHORITY") return "bg-amber-500";
  if (t.status === "BLOCKED" || t.hasUnmetDeps) return "bg-zinc-400";
  if (t.dueDate && new Date(t.dueDate) < now) return "bg-red-500";
  if (t.status === "IN_PROGRESS") return "bg-sky-500";
  return "bg-slate-400";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GanttChart({ tasks }: { tasks: GanttTask[] }) {
  const now = React.useMemo(() => startOfDay(new Date()), []);

  // Partition tasks into "datedTasks" (with at least one of startDate/dueDate)
  // and "undatedTasks" (rendered in a separate banner up top).
  const { datedTasks, undatedTasks, minDate, maxDate } = React.useMemo(() => {
    const dated: GanttTask[] = [];
    const undated: GanttTask[] = [];
    let min = startOfDay(addDays(now, -14));
    let max = startOfDay(addDays(now, 30));
    for (const t of tasks) {
      const range = resolveTaskRange(t);
      if (!range) {
        undated.push(t);
        continue;
      }
      dated.push(t);
      if (range[0] < min) min = range[0];
      if (range[1] > max) max = range[1];
    }
    // Pad the visible window on each side so bars don't kiss the edges.
    min = startOfDay(addDays(min, -3));
    max = startOfDay(addDays(max, 3));
    return { datedTasks: dated, undatedTasks: undated, minDate: min, maxDate: max };
  }, [tasks, now]);

  const totalDays = Math.max(1, diffDays(maxDate, minDate) + 1);
  const timelineWidthPx = totalDays * DAY_PX;

  // Group dated tasks by category (preserving Map insertion order — sort
  // first so the visual grouping is stable). Undated tasks live in their own
  // banner above and are NOT grouped here.
  const grouped = React.useMemo(() => {
    const byCat = new Map<string, GanttTask[]>();
    const sorted = [...datedTasks].sort((a, b) => {
      // Group by category alphabetically, then by start date within each group.
      const ca = a.category ?? "￿"; // nulls last
      const cb = b.category ?? "￿";
      if (ca !== cb) return ca.localeCompare(cb, "he");
      const sa = resolveTaskRange(a)![0].getTime();
      const sb = resolveTaskRange(b)![0].getTime();
      return sa - sb;
    });
    for (const t of sorted) {
      const key = t.category ?? NO_CATEGORY_LABEL;
      const arr = byCat.get(key);
      if (arr) arr.push(t);
      else byCat.set(key, [t]);
    }
    return Array.from(byCat.entries());
  }, [datedTasks]);

  // Compute month + week tick positions for the header.
  const ticks = React.useMemo(() => {
    const monthTicks: { left: number; label: string }[] = [];
    const weekTicks: { left: number; label: string }[] = [];
    const cursor = new Date(minDate);
    let prevMonth = -1;
    while (cursor <= maxDate) {
      const offset = diffDays(cursor, minDate);
      if (cursor.getMonth() !== prevMonth && cursor.getDate() <= 7) {
        monthTicks.push({
          left: offset * DAY_PX,
          label: `${MONTH_HE[cursor.getMonth()]} ${cursor.getFullYear()}`
        });
        prevMonth = cursor.getMonth();
      }
      // In Hebrew calendars the week starts on Sunday (day 0).
      if (cursor.getDay() === 0) {
        weekTicks.push({
          left: offset * DAY_PX,
          label: `${cursor.getDate()}/${cursor.getMonth() + 1}`
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return { monthTicks, weekTicks };
  }, [minDate, maxDate]);

  const todayLeftPx = diffDays(now, minDate) * DAY_PX;
  const todayInRange = now >= minDate && now <= maxDate;

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-border/70 bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
        אין משימות להצגה בציר זמן.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      {/* Legend + zoom — keeps Gantt self-documenting. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          ציר זמן ({datedTasks.length}
          {undatedTasks.length > 0 ? ` · ${undatedTasks.length} ללא תאריך` : ""})
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          <LegendDot color="bg-emerald-500" label="הושלם" />
          <LegendDot color="bg-sky-500" label="בתהליך" />
          <LegendDot color="bg-amber-500" label="ממתין/מוקפא" />
          <LegendDot color="bg-zinc-400" label="חסום" />
          <LegendDot color="bg-red-500" label="באיחור" />
          <LegendDot color="bg-slate-400" label="פתוח" />
        </div>
      </div>

      {undatedTasks.length > 0 && (
        <div className="border-b border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {undatedTasks.length}
          </span>{" "}
          משימות ללא תאריך התחלה או יעד אינן מופיעות בציר. הגדר תאריכים בעריכת
          המשימה כדי להוסיף אותן.
        </div>
      )}

      {/* The scroll container. The LEFT column is sticky inside this box;
          the timeline track scrolls horizontally underneath. */}
      <div className="relative max-h-[70vh] overflow-auto" dir="ltr">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${LEFT_COL_PX}px ${timelineWidthPx}px`
          }}
        >
          {/* ----- HEADER ----- */}
          <div
            className="sticky top-0 z-30 flex items-end border-b border-border/60 bg-muted/40 px-3 pb-1"
            style={{
              insetInlineStart: 0,
              height: HEADER_HEIGHT_PX,
              position: "sticky",
              left: 0
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              סיווג · משימה
            </span>
          </div>
          <div
            className="sticky top-0 z-20 border-b border-border/60 bg-muted/40"
            style={{ height: HEADER_HEIGHT_PX }}
          >
            <div className="relative h-full" style={{ width: timelineWidthPx }}>
              {ticks.monthTicks.map((m) => (
                <div
                  key={`m-${m.left}`}
                  className="absolute top-1 select-none text-[11px] font-semibold text-foreground"
                  style={{ left: m.left }}
                >
                  {m.label}
                </div>
              ))}
              {ticks.weekTicks.map((w) => (
                <div
                  key={`w-${w.left}`}
                  className="absolute bottom-1 select-none text-[9px] tabular-nums text-muted-foreground"
                  style={{ left: w.left }}
                >
                  <span className="block h-2 w-px bg-border" />
                  {w.label}
                </div>
              ))}
              {todayInRange && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-indigo-500/70"
                  style={{ left: todayLeftPx }}
                />
              )}
            </div>
          </div>

          {/* ----- BODY: one section per category ----- */}
          {grouped.map(([category, items], gi) => (
            <CategoryGroup
              key={`g-${gi}-${category}`}
              category={category}
              tasks={items}
              minDate={minDate}
              timelineWidthPx={timelineWidthPx}
              todayLeftPx={todayInRange ? todayLeftPx : null}
              now={now}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CategoryGroup({
  category,
  tasks,
  minDate,
  timelineWidthPx,
  todayLeftPx,
  now
}: {
  category: string;
  tasks: GanttTask[];
  minDate: Date;
  timelineWidthPx: number;
  todayLeftPx: number | null;
  now: Date;
}) {
  return (
    <>
      {/* Section header spans both columns. Sticky LEFT cell + scrolling RIGHT cell. */}
      <div
        className="sticky z-20 flex items-center gap-2 border-b border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground"
        style={{ left: 0 }}
      >
        <span>{category}</span>
        <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        className="border-b border-t border-border/60 bg-muted/30"
        style={{ width: timelineWidthPx }}
      />

      {tasks.map((t) => (
        <GanttRow
          key={t.id}
          task={t}
          minDate={minDate}
          timelineWidthPx={timelineWidthPx}
          todayLeftPx={todayLeftPx}
          now={now}
        />
      ))}
    </>
  );
}

function GanttRow({
  task,
  minDate,
  timelineWidthPx,
  todayLeftPx,
  now
}: {
  task: GanttTask;
  minDate: Date;
  timelineWidthPx: number;
  todayLeftPx: number | null;
  now: Date;
}) {
  const range = resolveTaskRange(task);
  if (!range) return null; // safety — undated tasks already filtered upstream
  const [s, e] = range;
  const leftPx = diffDays(s, minDate) * DAY_PX;
  const widthPx = Math.max(DAY_PX, (diffDays(e, s) + 1) * DAY_PX);
  const color = barColorFor(task, now);

  // Tooltip uses CSS-only group-hover. Position above unless we're in the top
  // 80px of the scroll container — then flip below to avoid clipping.
  return (
    <>
      {/* LEFT cell — sticky task name */}
      <div
        className="sticky z-10 flex items-center gap-1.5 border-b border-border/40 bg-card px-3 py-1.5 text-[12px]"
        style={{ left: 0, height: ROW_HEIGHT_PX }}
      >
        <span
          className={cn(
            "truncate",
            task.status === "COMPLETED" && "line-through text-muted-foreground"
          )}
          title={task.name}
        >
          {task.name}
        </span>
        {task.isSpotlight && (
          <span className="size-1.5 shrink-0 rounded-full bg-yellow-500" aria-label="זרקור" />
        )}
      </div>

      {/* RIGHT cell — timeline track with the bar */}
      <div
        className="relative border-b border-border/40 bg-card"
        style={{ height: ROW_HEIGHT_PX, width: timelineWidthPx }}
      >
        {/* Today line per row (so it stays visible on long rows below the header). */}
        {todayLeftPx !== null && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-indigo-500/40"
            style={{ left: todayLeftPx }}
          />
        )}
        {/* The bar itself + tooltip */}
        <div
          className="group absolute top-1/2 -translate-y-1/2"
          style={{ left: leftPx, width: widthPx, height: 22 }}
        >
          <div
            className={cn(
              "relative h-full rounded-md shadow-sm ring-1 ring-black/5 transition-all duration-150",
              color,
              task.priority === "URGENT" && "outline outline-2 outline-offset-1 outline-red-600/40",
              "hover:brightness-110 hover:shadow-md"
            )}
            tabIndex={0}
            aria-label={`${task.name} — ${TASK_STATUS_LABEL[task.status]}`}
          >
            {/* Tiny inset label (clipped if too narrow — that's OK). */}
            <span className="absolute inset-0 flex items-center justify-center px-2 text-[10px] font-medium text-white drop-shadow-sm">
              {task.priority === "URGENT" ? "⚠ " : ""}
              <span className="truncate" dir="rtl">{task.name}</span>
            </span>
          </div>

          {/* Tooltip — pure CSS, shown on group hover/focus. */}
          <div
            className="pointer-events-none absolute bottom-full mb-2 left-1/2 z-40 min-w-[16rem] -translate-x-1/2 scale-95 rounded-lg border border-border/70 bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
            role="tooltip"
            dir="rtl"
          >
            <div className="mb-1 text-[13px] font-semibold leading-snug">
              {task.name}
            </div>
            <TooltipRow label="סטטוס" value={TASK_STATUS_LABEL[task.status]} />
            {task.responsibility && (
              <TooltipRow
                label="אחריות"
                value={TASK_RESPONSIBILITY_LABEL[task.responsibility]}
              />
            )}
            <TooltipRow label="אחראי" value={task.assigneeName ?? "לא משויך"} />
            <TooltipRow
              label="התחלה"
              value={task.startDate ? formatDate(task.startDate) : "—"}
            />
            <TooltipRow
              label="יעד"
              value={task.dueDate ? formatDate(task.dueDate) : "—"}
            />
            {task.priority === "URGENT" && (
              <div className="mt-1 inline-block rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                דחוף
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("inline-block size-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}
