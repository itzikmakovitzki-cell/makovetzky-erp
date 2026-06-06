import { Fragment } from "react";
import { Star, Lock, Hourglass, MessageSquare } from "lucide-react";
import type { Prisma, TaskResponsibility } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteTask } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import type {
  TaskNoteItem,
  TaskNotesViewer
} from "@/components/tasks/task-notes-panel";
import { formatDateTime } from "@/lib/utils";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { InlineAssignee } from "@/components/tasks/inline-assignee";
import { InlineDueDate } from "@/components/tasks/inline-due-date";
import { SnoozeButton } from "@/components/tasks/snooze-button";
import { SnoozeBadge } from "@/components/tasks/snooze-badge";
import { TaskTitle } from "@/components/tasks/task-title";
import { WhatsAppReminderButton } from "@/components/tasks/whatsapp-reminder-button";
import { SpotlightToggle } from "@/components/permit/spotlight-toggle";
import { DependencyOverride } from "@/components/permit/dependency-override";
import { SoftDeleteButton } from "@/components/global/soft-delete-button";
import { MagicLinkButton } from "@/components/permit/magic-link-button";
import { PermitTasksXlsxToolbar } from "@/components/permit/permit-tasks-xlsx-toolbar";
import { TaskEditButton } from "@/components/permit/task-edit-dialog";
import { CreateTaskButton } from "@/components/permit/task-create-dialog";
import { TasksCategoryFilter } from "@/components/permit/tasks-category-filter";
import { PermitTaskMobileCard } from "@/components/permit/permit-task-mobile-card";
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

export async function TasksTable({
  permitId,
  categoryFilter
}: {
  permitId: string;
  // When set, only tasks with this exact category render. Categories present
  // on the permit are computed independently of the filter, so the dropdown
  // stays stable as the user narrows the view.
  categoryFilter?: string | null;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  // Viewer identity for the notes panel — drives per-row edit/delete
  // affordances client-side. Server actions re-verify.
  const viewer: TaskNotesViewer | null = session?.user?.id
    ? {
        id: session.user.id,
        role: session.user.role as TaskNotesViewer["role"]
      }
    : null;

  const taskWhere: Prisma.TaskWhereInput = {
    permitId,
    deletedAt: null,
    ...(categoryFilter ? { category: categoryFilter } : {})
  };

  const [tasks, assignees, permitCategoryRows, globalCategoryRows] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: { select: { id: true, name: true, phone: true } },
        template: { select: { name: true } },
        permit: { select: { name: true } },
        dependsOn: {
          include: {
            dependsOn: { select: { id: true, name: true, status: true } }
          }
        },
        // Block 34 — task notes ordered newest-first so the inline cell
        // can show the latest entry without re-sorting client-side.
        notes: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            authorId: true,
            author: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" }
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
    // Categories on *this* permit — drives the filter dropdown.
    prisma.task.findMany({
      where: { permitId, deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" }
    }),
    // All categories anywhere — feeds the edit-dialog autocomplete.
    prisma.task.findMany({
      where: { deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
      take: 200
    })
  ]);

  const permitCategories = permitCategoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c);
  const categorySuggestions = globalCategoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c);

  const now = new Date();
  const visibleTaskIds = tasks.map((t) => t.id);

  return (
    <BulkSelectionProvider>
      <BulkTaskActionBar users={assignees} canDelete={isAdmin} />

      <div className="md:hidden flex flex-col gap-2 mb-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            משימות ({tasks.length})
          </h2>
          <div className="flex items-center gap-2">
            <TasksCategoryFilter
              categories={permitCategories}
              current={categoryFilter ?? null}
            />
            <CreateTaskButton
              permitId={permitId}
              assignees={assignees}
              categorySuggestions={categorySuggestions}
            />
          </div>
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין משימות בהיתר זה
          </div>
        ) : (
          tasks.map((t, idx) => {
            const prevCategory = idx > 0 ? tasks[idx - 1].category : null;
            const showBand = !!t.category && t.category !== prevCategory;
            return (
              <Fragment key={t.id}>
                {showBand && (
                  <div className="mt-1 px-1 text-[11px] font-semibold text-muted-foreground">
                    {t.category}
                  </div>
                )}
                <PermitTaskMobileCard
                  task={t}
                  assignees={assignees}
                  categorySuggestions={categorySuggestions}
                  isAdmin={isAdmin}
                  viewer={viewer ?? { id: "anon", role: "EMPLOYEE" }}
                  now={now}
                />
              </Fragment>
            );
          })
        )}
      </div>

      <div className="hidden md:block rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            משימות ({tasks.length})
          </h2>
          <TasksCategoryFilter
            categories={permitCategories}
            current={categoryFilter ?? null}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="bg-red-500" label="באיחור" />
            <LegendDot color="bg-amber-500" label="ממתין לרשות / מוקפא" />
            <LegendDot color="bg-zinc-400" label="חסום ע״י תלות" />
            <span className="inline-flex items-center gap-1">
              <Star className="size-3 fill-yellow-500 text-yellow-500" /> Managerial Spotlight
            </span>
          </div>
          <CreateTaskButton
            permitId={permitId}
            assignees={assignees}
            categorySuggestions={categorySuggestions}
          />
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
          {tasks.map((t, idx) => {
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

            // Visual category grouping (PR-D of the polish sweep): insert a
            // band row before the first task of each new category. Tasks are
            // already sorted by category-asc first (PR #34) so the iteration
            // order does the grouping for us. Uncategorised tasks (category
            // null) skip the band.
            const prevCategory = idx > 0 ? tasks[idx - 1].category : null;
            const showBand = !!t.category && t.category !== prevCategory;

            return (
              <Fragment key={t.id}>
                {showBand && (
                  <tr>
                    <td
                      colSpan={11}
                      className="bg-muted/40 px-3 py-1 text-[11px] font-semibold text-muted-foreground"
                    >
                      {t.category}
                    </td>
                  </tr>
                )}
              <tr
                className={cn(
                  "group hover:bg-muted/30",
                  isCompleted && "task-completed"
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
                  <div className="font-medium">
                    <TaskTitle name={t.name} />
                  </div>
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
                  <div className="flex items-center gap-0.5">
                    <InlineAssignee
                      taskId={t.id}
                      assigneeId={t.assignee?.id ?? null}
                      users={assignees}
                    />
                    <WhatsAppReminderButton
                      assigneeName={t.assignee?.name ?? null}
                      phone={t.assignee?.phone ?? null}
                      taskName={t.name}
                      projectName={t.permit.name}
                    />
                  </div>
                </td>
                <td>
                  <div className="flex flex-col items-start gap-0.5">
                    <InlineDueDate
                      taskId={t.id}
                      value={t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null}
                      isOverdue={isOverdue}
                      frozen={t.frozen}
                    />
                    <SnoozeBadge count={t.snoozeCount} />
                  </div>
                </td>
                <td className="text-[11px] text-muted-foreground">
                  <div className="flex flex-col gap-1">
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
                    <LatestNotePreview notes={t.notes} totalCount={t.notes.length} />
                  </div>
                </td>
                <td className="p-0">
                  <div className="flex items-center justify-center gap-0.5">
                    <SnoozeButton taskId={t.id} />
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
                      notes={t.notes.map(toNoteItem)}
                      viewer={
                        viewer ?? { id: "anon", role: "EMPLOYEE" }
                      }
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
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </BulkSelectionProvider>
  );
}

// Block 34 — shape the Prisma row into the panel's serializable item
// (Dates → ISO strings so the prop crosses the client boundary cleanly).
type RawTaskNote = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  author: { name: string } | null;
};

function toNoteItem(n: RawTaskNote): TaskNoteItem {
  return {
    id: n.id,
    content: n.content,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    authorId: n.authorId,
    authorName: n.author?.name ?? null
  };
}

// Compact one-line preview of the latest note ("בת אור · 04/06 12:30 ·
// שלחתי מייל…"). Click pencil on the row → opens dialog → full thread.
function LatestNotePreview({
  notes,
  totalCount
}: {
  notes: RawTaskNote[];
  totalCount: number;
}) {
  if (totalCount === 0) return null;
  const latest = notes[0];
  return (
    <div className="flex items-start gap-1 text-[10px] text-muted-foreground">
      <MessageSquare className="size-3 shrink-0 translate-y-[1px]" />
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-foreground/80">
            {latest.author?.name ?? "—"}
          </span>
          <span>·</span>
          <span className="tabular-nums">{formatDateTime(latest.createdAt)}</span>
          {totalCount > 1 && (
            <span className="rounded bg-muted px-1 text-[9px]">+{totalCount - 1}</span>
          )}
        </div>
        <div className="truncate" title={latest.content}>{latest.content}</div>
      </div>
    </div>
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
