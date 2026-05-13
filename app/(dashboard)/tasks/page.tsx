import Link from "next/link";
import { Star, Lock, Hourglass } from "lucide-react";
import type { Prisma, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { TasksFilterBar } from "@/components/global/tasks-filter-bar";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<TaskStatus>([
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
]);

function parseStatuses(raw: string | undefined): TaskStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => VALID_STATUSES.has(s as TaskStatus)) as TaskStatus[];
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

  const statuses = parseStatuses(statusParam);

  const where: Prisma.TaskWhereInput = {};
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

  const [tasks, users] = await Promise.all([
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
    })
  ]);

  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h1 className="text-base font-semibold">משימות — מבט-על</h1>
        <p className="text-[11px] text-muted-foreground">
          תצוגה חוצת-פרויקטים. סינון נשמר ב-URL — אפשר לסמן כסימנייה.
        </p>
      </header>

      <TasksFilterBar users={users} />

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
                <td colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
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
