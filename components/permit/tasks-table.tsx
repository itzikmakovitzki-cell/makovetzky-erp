import { Star, Lock, Hourglass } from "lucide-react";
import type { TaskResponsibility } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteTask } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { InlineAssignee } from "@/components/tasks/inline-assignee";
import { InlineDueDate } from "@/components/tasks/inline-due-date";
import { SpotlightToggle } from "@/components/permit/spotlight-toggle";
import { DependencyOverride } from "@/components/permit/dependency-override";
import { SoftDeleteButton } from "@/components/global/soft-delete-button";
import { MagicLinkButton } from "@/components/permit/magic-link-button";
import { PermitTasksXlsxToolbar } from "@/components/permit/permit-tasks-xlsx-toolbar";
import { TaskEditButton } from "@/components/permit/task-edit-dialog";
import { BulkTaskActionBar } from "@/components/tasks/bulk-task-action-bar";
import {
  TaskBulkCheckbox,
  TaskBulkSelectAll
} from "@/components/tasks/task-bulk-checkbox";
import { BulkSelectionProvider } from "@/lib/use-bulk-selection";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT
} from "@/lib/status-maps";
import { cn } from "@/lib/utils";

export async function TasksTable({ permitId }: { permitId: string }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const [tasks, assignees, categoryRows] = await Promise.all([
    prisma.task.findMany({
      where: { permitId, deletedAt: null },
      include: {
        assignee: { select: { id: true, name: true } },
        template: { select: { name: true } },
        dependsOn: {
          include: {
            dependsOn: { select: { id: true, name: true, status: true } }
          }
        }
      },
      orderBy: [{ isSpotlight: "desc" }, { priority: "desc" }, { dueDate: "asc" }]
    }),
    prisma.user.findMany({
      // Block 20: contractors are valid assignment targets.
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
    })
  ]);

  const categorySuggestions = categoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c);

  const now = new Date();
  const visibleTaskIds = tasks.map((t) => t.id);

  return (
    <BulkSelectionProvider>
      <BulkTaskActionBar users={assignees} canDelete={isAdmin} />
      <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          משימות ({tasks.length})
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="bg-red-500" label="באיחור" />
            <LegendDot color="bg-amber-500" label="ממתין לרשות / מוקפא" />
            <LegendDot color="bg-zinc-400" label="חסום ע״י תלות" />
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-yellow-500 text-yellow-500" /> Managerial Spotlight
            </span>
          </div>
          <PermitTasksXlsxToolbar permitId={permitId} canImport={isAdmin} />
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th className="w-9 p-1 text-center">
              <TaskBulkSelectAll visibleIds={visibleTaskIds} />
            </th>
            <th className="w-1.5 p-0"></th>
            <th className="w-7"></th>
            <th>משימה</th>
            <th className="w-44">סיווג</th>
            <th className="w-36">סטטוס</th>
            <th className="w-20">עדיפות</th>
            <th className="w-32">אחראי</th>
            <th className="w-28">תאריך יעד</th>
            <th>חסימה / הערות</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={11} className="py-6 text-center text-xs text-muted-foreground">
                אין משימות בהיתר זה
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
                <td className="p-1 text-center">
                  <TaskBulkCheckbox taskId={t.id} />
                </td>
                <td className={cn("p-0", indicatorColor)} />
                <td className="text-center">
                  <SpotlightToggle taskId={t.id} isSpotlight={t.isSpotlight} />
                </td>
                <td>
                  <div className={cn("font-medium", isCompleted && "line-through")}>{t.name}</div>
                  {t.template && (
                    <div className="text-[10px] text-muted-foreground">
                      תבנית: {t.template.name}
                    </div>
                  )}
                </td>
                <td>
                  <ClassificationCell
                    category={t.category}
                    responsibility={t.responsibility}
                    tags={t.tags}
                  />
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <TaskStatusControl taskId={t.id} currentStatus={t.status} />
                    {t.frozen && (
                      <Hourglass
                        className="size-3 text-amber-600"
                        aria-label="מוקפא — תאריך יעד לא רץ"
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
                <td>
                  <InlineAssignee
                    taskId={t.id}
                    assigneeId={t.assignee?.id ?? null}
                    users={assignees}
                  />
                </td>
                <td>
                  <InlineDueDate
                    taskId={t.id}
                    value={t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null}
                    isOverdue={isOverdue}
                    frozen={t.frozen}
                  />
                </td>
                <td className="text-[11px] text-muted-foreground">
                  {isBlockedByDeps ? (
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3 shrink-0" />
                        <span>חסום ע״י:</span>
                      </span>
                      {unmetDeps.map((d, i) => (
                        <span key={d.dependsOn.id} className="inline-flex items-center gap-1">
                          <span>{d.dependsOn.name}</span>
                          <DependencyOverride
                            taskId={t.id}
                            dependsOnTaskId={d.dependsOn.id}
                            dependsOnName={d.dependsOn.name}
                          />
                          {i < unmetDeps.length - 1 && (
                            <span className="text-muted-foreground/50">·</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : t.frozen ? (
                    <span>ממתין לתשובת רשות — תאריך יעד מוקפא</span>
                  ) : null}
                </td>
                <td className="p-0">
                  <div className="flex items-center justify-center gap-0.5">
                    <TaskEditButton
                      task={{
                        id: t.id,
                        name: t.name,
                        description: t.description ?? "",
                        category: t.category ?? "",
                        responsibility: t.responsibility ?? "",
                        tags: t.tags,
                        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
                        priority: t.priority,
                        assigneeId: t.assignee?.id ?? ""
                      }}
                      assignees={assignees}
                      categorySuggestions={categorySuggestions}
                    />
                    <MagicLinkButton taskId={t.id} taskName={t.name} />
                    {isAdmin && (
                      <SoftDeleteButton
                        action={deleteTask}
                        id={t.id}
                        label={t.name}
                        variant="icon"
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </BulkSelectionProvider>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-sm", color)} />
      {label}
    </span>
  );
}

function ClassificationCell({
  category,
  responsibility,
  tags
}: {
  category: string | null;
  responsibility: TaskResponsibility | null;
  tags: string[];
}) {
  if (!category && !responsibility && tags.length === 0) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {category && <span className="text-[10px] text-muted-foreground">{category}</span>}
      {responsibility && (
        <Badge variant={TASK_RESPONSIBILITY_VARIANT[responsibility]}>
          {TASK_RESPONSIBILITY_LABEL[responsibility]}
        </Badge>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {tags.map((tag) => (
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
  );
}
