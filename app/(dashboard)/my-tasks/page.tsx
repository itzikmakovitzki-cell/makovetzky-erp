import { redirect } from "next/navigation";
import type { Prisma, TaskStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { greetingForHour, israelHour } from "@/lib/greeting";
import { MyTasksFilterBar } from "@/components/tasks/my-tasks-filter-bar";
import { MyTasksView } from "@/components/tasks/my-tasks-view";
import { InboxGreeting } from "@/components/tasks/inbox-greeting";
import type { DueState, MyTask } from "@/components/tasks/my-tasks-types";

export const dynamic = "force-dynamic";

type Timeframe = "today" | "week" | "month";
type StateFilter = "active" | "waiting" | "overdue";

const VALID_TIMEFRAMES = new Set<Timeframe>(["today", "week", "month"]);
const VALID_STATES = new Set<StateFilter>(["active", "waiting", "overdue"]);

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// Upper bound of the selected timeframe (inclusive). "This week" ends Saturday
// (Israeli calendar week, Sun–Sat); "this month" ends on the last day.
function timeframeEnd(tf: Timeframe, now: Date): Date {
  if (tf === "today") return endOfDay(now);
  if (tf === "week") {
    const d = new Date(now);
    const daysToSat = 6 - d.getDay(); // 0 = Sunday … 6 = Saturday
    d.setDate(d.getDate() + daysToSat);
    return endOfDay(d);
  }
  // month
  return endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

function computeDueState(
  due: Date | null,
  frozen: boolean,
  completed: boolean,
  startToday: Date,
  endToday: Date
): DueState {
  if (!due) return null;
  if (completed) return "future"; // billed/closed work is never "red"
  if (!frozen && due < startToday) return "overdue";
  if (due >= startToday && due <= endToday) return "today";
  return "future";
}

export default async function MyTasksPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const params = await searchParams;
  const projectParam =
    typeof params.project === "string" && params.project ? params.project : undefined;
  const categoryParam =
    typeof params.category === "string" && params.category.trim()
      ? params.category.trim()
      : undefined;
  const timeframeParam =
    typeof params.timeframe === "string" &&
    VALID_TIMEFRAMES.has(params.timeframe as Timeframe)
      ? (params.timeframe as Timeframe)
      : undefined;
  const stateParam =
    typeof params.state === "string" && VALID_STATES.has(params.state as StateFilter)
      ? (params.state as StateFilter)
      : undefined;

  const now = new Date();
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);

  const where: Prisma.TaskWhereInput = {
    assigneeId: userId,
    deletedAt: null,
    permit: { deletedAt: null }
  };
  if (projectParam) where.permitId = projectParam;
  if (categoryParam) where.category = categoryParam;

  if (stateParam === "active") {
    where.status = { in: ["OPEN", "IN_PROGRESS"] };
  } else if (stateParam === "waiting") {
    where.status = "AWAITING_AUTHORITY";
  } else if (stateParam === "overdue") {
    where.status = { notIn: ["COMPLETED"] };
    where.frozen = false;
  }

  // Due-date window combines the timeframe upper bound with the overdue lower
  // bound. Both present → Prisma ANDs them (overdue wins). A date filter also
  // implicitly drops tasks with no due date, which is the desired behavior.
  const dueFilter: Prisma.DateTimeNullableFilter = {};
  if (timeframeParam) dueFilter.lte = timeframeEnd(timeframeParam, now);
  if (stateParam === "overdue") dueFilter.lt = startToday;
  if (Object.keys(dueFilter).length > 0) where.dueDate = dueFilter;

  // Workload counts for the greeting — deliberately independent of the active
  // filters so the banner always reflects the real picture: everything due by
  // end of today (or earlier) that isn't done, and the overdue subset.
  const followUpBase: Prisma.TaskWhereInput = {
    assigneeId: userId,
    deletedAt: null,
    permit: { deletedAt: null },
    status: { not: "COMPLETED" }
  };

  const [rows, projectRows, categoryRows, users, todayCount, overdueCount] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true, phone: true } },
        permit: {
          select: {
            id: true,
            name: true,
            permitNumber: true,
            masterDeal: {
              select: { client: { select: { id: true, companyName: true } } }
            }
          }
        }
      },
      orderBy: [
        { isSpotlight: "desc" },
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" }
      ]
    }),
    // Distinct projects the user has tasks in — populates the filter dropdown
    // regardless of the currently applied filters.
    prisma.task.findMany({
      where: { assigneeId: userId, deletedAt: null, permit: { deletedAt: null } },
      select: { permitId: true, permit: { select: { name: true } } },
      distinct: ["permitId"]
    }),
    // Distinct categories the user has tasks in — feeds the filter dropdown.
    // Same "independent of current filters" rule as projects above.
    prisma.task.findMany({
      where: {
        assigneeId: userId,
        deletedAt: null,
        permit: { deletedAt: null },
        category: { not: null }
      },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" }
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["ADMIN", "EMPLOYEE", "CONTRACTOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.task.count({
      where: { ...followUpBase, dueDate: { lte: endToday } }
    }),
    prisma.task.count({
      where: { ...followUpBase, frozen: false, dueDate: { lt: startToday } }
    })
  ]);

  const { greeting } = greetingForHour(israelHour(now));

  const tasks: MyTask[] = rows.map((t) => {
    const completed = t.status === "COMPLETED";
    return {
      id: t.id,
      name: t.name,
      status: t.status as TaskStatus,
      priority: t.priority,
      frozen: t.frozen,
      isSpotlight: t.isSpotlight,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      dueState: computeDueState(t.dueDate, t.frozen, completed, startToday, endToday),
      snoozeCount: t.snoozeCount,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee?.name ?? null,
      assigneePhone: t.assignee?.phone ?? null,
      permitId: t.permit.id,
      permitName: t.permit.name,
      permitNumber: t.permit.permitNumber,
      clientId: t.permit.masterDeal.client.id,
      clientName: t.permit.masterDeal.client.companyName
    };
  });

  const projects = projectRows
    .map((r) => ({ id: r.permitId, name: r.permit.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const categories = categoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c && c.trim() !== "");

  return (
    <section className="flex flex-col gap-5">
      <InboxGreeting
        greeting={greeting}
        name={session.user?.name ?? null}
        todayCount={todayCount}
        overdueCount={overdueCount}
        visibleCount={tasks.length}
      />

      <MyTasksFilterBar projects={projects} categories={categories} />

      <MyTasksView tasks={tasks} users={users} />
    </section>
  );
}
