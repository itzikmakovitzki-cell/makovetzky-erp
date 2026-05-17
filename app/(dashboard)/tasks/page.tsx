import Link from "next/link";
import { Star, Lock, Hourglass } from "lucide-react";
import type { Prisma, TaskResponsibility, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { TasksFilterBar } from "@/components/global/tasks-filter-bar";
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
      where: { isActive: true, role: { in: ["ADMIN", "EMPLOYEE"] } },
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

  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h1 className="text-base font-semibold">משימות — מבט-על</h1>
        <p className="text-[11px] text-muted-foreground">
          תצוגה חוצת-פרויקטים. סינון נשמר ב-URL — אפשר לסמן כסימנייה.
        </p>
      </header>

      <TasksFilterBar users={users} categories={categories} tags={tags} />

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תוצאות ({tasks.length})
          </h2>
        </div>

        <table>
          <thead>
            <tr>
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
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-xs text-muted-foreground">
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
                    "group hover:bg-muted/30",
                    isCompleted && "text-muted-foreground"
                  )}
                >
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
