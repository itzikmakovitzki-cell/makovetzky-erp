import Link from "next/link";
import { Star, Lock, Hourglass } from "lucide-react";
import type { Prisma, TaskResponsibility, TaskStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { TasksFilterBar } from "@/components/global/tasks-filter-bar";
import { TaskMobileCard } from "@/components/tasks/task-mobile-card";
import { TaskRowActions } from "@/components/tasks/task-row-actions";
import { BulkTaskActionBar } from "@/components/tasks/bulk-task-action-bar";
import { PageHeader } from "@/components/global/page-header";
import {
  TaskBulkCheckbox,
  TaskBulkSelectAll
} from "@/components/tasks/task-bulk-checkbox";
import { BulkSelectionProvider } from "@/lib/use-bulk-selection";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<TaskStatus>([
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
]);

const VALID_RESPONSIBILITIES = new Set<TaskResponsibility>([
  "INTERNAL",
  "CLIENT",
  "CONTRACTOR",
  "AUTHORITY"
]);

function parseStatuses(raw: string | undefined): TaskStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => VALID_STATUSES.has(s as TaskStatus)) as TaskStatus[];
}

function parseResponsibilities(raw: string | undefined): TaskResponsibility[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((r) =>
      VALID_RESPONSIBILITIES.has(r as TaskResponsibility)
    ) as TaskResponsibility[];
}

export default async function TasksGlobalPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const assigneeParam =
    typeof params.assignee === "string" ? params.assignee : undefined;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const spotlightOnly = params.spotlight === "true";
  const categoryParam =
    typeof params.category === "string" && params.category
      ? params.category
      : undefined;
  const responsibilityParam =
    typeof params.responsibility === "string" ? params.responsibility : undefined;
  const tagParam =
    typeof params.tag === "string" && params.tag ? params.tag : undefined;

  const statuses = parseStatuses(statusParam);
  const responsibilities = parseResponsibilities(responsibilityParam);

  const where: Prisma.TaskWhereInput = {
    deletedAt: null,
    // Hide tasks whose parent permit is soft-deleted too — keeps the global
    // view consistent with /permits filtering.
    permit: { deletedAt: null }
  };
  if (assigneeParam === "unassigned") {
    where.assigneeId = null;
  } else if (assigneeParam) {
    where.assigneeId = assigneeParam;
  }
  if (statuses.length > 0) {
    where.status = { in: statuses };
  }
  if (spotlightOnly) {
    where.isSpotlight = true;
  }
  if (categoryParam) {
    where.category = categoryParam;
  }
  if (responsibilities.length > 0) {
    where.responsibility = { in: responsibilities };
  }
  if (tagParam) {
    where.tags = { has: tagParam };
  }

  const [tasks, users, categoryRows, tagRows] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, name: true } },
        permit: { select: { id: true, name: true, permitNumber: true } },
        dependsOn: {
          select: {
            overriddenByAdmin: true,
            dependsOn: { select: { id: true, name: true, status: true } }
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
    prisma.user.findMany({
      // Block 20: include CONTRACTOR so external partners (e.g. Sigal at
      // Bisis Handasa) show up in the assignee dropdown. The portal already
      // enforces scoped visibility for contractors, so it's safe to surface
      // them as assignment targets.
      where: { isActive: true, role: { in: ["ADMIN", "EMPLOYEE", "CONTRACTOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.task.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
      take: 200
    }),
    prisma.task.findMany({
      where: { deletedAt: null, NOT: { tags: { isEmpty: true } } },
      select: { tags: true },
      take: 500
    })
  ]);

  const categories = categoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c);
  const tagSet = new Set<string>();
  for (const row of tagRows) for (const t of row.tags) tagSet.add(t);
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "he"));

  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const visibleTaskIds = tasks.map((t) => t.id);

  const now = new Date();

  return (
    <BulkSelectionProvider>
      <section className="flex flex-col gap-3">
      <PageHeader
        title="משימות"
        accent="מבט-על"
        description="תצוגה חוצת-פרויקטים. סינון נשמר ב-URL — אפשר לסמן כסימנייה."
      />

      <BulkTaskActionBar users={users} canDelete={isAdmin} />

      <TasksFilterBar users={users} categories={categories} tags={tags} />

      <div className="md:hidden flex flex-col gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          תוצאות ({tasks.length})
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין משימות תואמות לסינון
          </div>
        ) : (
          tasks.map((t) => (
            // Wrapper keeps the existing Link-based card untouched while
            // overlaying a checkbox in the top-start corner. The checkbox
            // stops propagation so the card's tap-to-navigate behavior is
            // preserved everywhere else.
            <div key={t.id} className="relative">
              <TaskBulkCheckbox
                taskId={t.id}
                className="absolute top-3 start-3 z-10 shadow-sm"
              />
              <TaskMobileCard task={t} now={now} />
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תוצאות ({tasks.length})
          </h2>
        </div>

        <table className="table-sticky-head">
          <thead>
            <tr>
              <th className="w-9 p-1 text-center">
                <TaskBulkSelectAll visibleIds={visibleTaskIds} />
              </th>
              <th className="w-1.5 p-0"></th>
              <th className="w-7"></th>
              <th>היתר</th>
              <th>משימה</th>
              <th className="w-44">סיווג</th>
              <th className="w-36">סטטוס</th>
              <th className="w-20">עדיפות</th>
              <th className="w-32">אחראי</th>
              <th className="w-28">תאריך יעד</th>
              <th>חסימה</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-xs text-muted-foreground">
                  אין משימות תואמות לסינון
                </td>
              </tr>
            )}
            {tasks.map((t) => {
              const isCompleted = t.status === "COMPLETED";
              const isOverdue =
                !!t.dueDate && !t.frozen && !isCompleted && new Date(t.dueDate) < now;
              const unmetDeps = t.dependsOn.filter(
                (d) => d.dependsOn.status !== "COMPLETED" && !d.overriddenByAdmin
              );
              const isBlockedByDeps = !isCompleted && unmetDeps.length > 0;

              const indicatorColor = isOverdue
                ? "bg-red-500"
                : t.frozen
                  ? "bg-amber-500"
                  : isBlockedByDeps || t.status === "BLOCKED"
                    ? "bg-zinc-400"
                    : "bg-transparent";

              return (
                <tr
                  key={t.id}
                  className={cn(
                    "group hover:bg-muted/50",
                    isCompleted && "text-muted-foreground"
                  )}
                >
                  <td className="p-1 text-center">
                    <TaskBulkCheckbox taskId={t.id} />
                  </td>
                  <td className={cn("p-0", indicatorColor)} />
                  <td className="text-center">
                    {t.isSpotlight && (
                      <Star
                        className="inline size-3 fill-yellow-500 text-yellow-500"
                        aria-label="Managerial Spotlight"
                      />
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/permits/${t.permit.id}/tasks`}
                      className="text-xs underline-offset-2 hover:underline"
                      title={t.permit.permitNumber ?? undefined}
                    >
                      {t.permit.name}
                    </Link>
                  </td>
                  <td>
                    <div className={cn("font-medium", isCompleted && "line-through")}>
                      {t.name}
                    </div>
                  </td>
                  <td>
                    {!t.category && !t.responsibility && t.tags.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {t.category && (
                          <span className="text-[10px] text-muted-foreground">
                            {t.category}
                          </span>
                        )}
                        {t.responsibility && (
                          <Badge variant={TASK_RESPONSIBILITY_VARIANT[t.responsibility]}>
                            {TASK_RESPONSIBILITY_LABEL[t.responsibility]}
                          </Badge>
                        )}
                        {t.tags.length > 0 && (
                          <div className="flex flex-wrap gap-0.5">
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded bg-muted px-1 py-0 text-[9px] text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <TaskStatusControl taskId={t.id} currentStatus={t.status} />
                      {t.frozen && (
                        <Hourglass
                          className="size-3 text-amber-600"
                          aria-label="מוקפא"
                        />
                      )}
                    </div>
                  </td>
                  <td>
                    {t.priority === "URGENT" ? (
                      <Badge variant="destructive">דחוף</Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">רגיל</span>
                    )}
                  </td>
                  <td className="text-xs">{t.assignee?.name ?? <span className="text-muted-foreground">לא משויך</span>}</td>
                  <td
                    className={cn(
                      "text-xs tabular-nums",
                      isOverdue && "font-semibold text-red-600",
                      t.frozen && "text-amber-700"
                    )}
                  >
                    {formatDate(t.dueDate)}
                    {isOverdue && <span className="ms-1 text-[10px]">איחור</span>}
                  </td>
                  <td className="text-[11px] text-muted-foreground">
                    {isBlockedByDeps && (
                      <span className="inline-flex items-start gap-1">
                        <Lock className="mt-0.5 size-3 shrink-0" />
                        <span>{unmetDeps.map((d) => d.dependsOn.name).join(", ")}</span>
                      </span>
                    )}
                  </td>
                  <td className="p-1 text-center">
                    <TaskRowActions
                      task={{
                        id: t.id,
                        name: t.name,
                        dueDate: t.dueDate,
                        priority: t.priority,
                        assigneeId: t.assigneeId,
                        responsibility: t.responsibility,
                        category: t.category,
                        isSpotlight: t.isSpotlight
                      }}
                      users={users}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </section>
    </BulkSelectionProvider>
  );
}
