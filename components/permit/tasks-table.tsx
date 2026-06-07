import { Fragment } from "react";
import { Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { TaskNotesViewer } from "@/components/tasks/task-notes-panel";
import { PermitTasksXlsxToolbar } from "@/components/permit/permit-tasks-xlsx-toolbar";
import { CreateTaskButton } from "@/components/permit/task-create-dialog";
import { TasksCategoryFilter } from "@/components/permit/tasks-category-filter";
import { PermitTaskMobileCard } from "@/components/permit/permit-task-mobile-card";
import { BulkTaskActionBar } from "@/components/tasks/bulk-task-action-bar";
import { TaskBulkSelectAll } from "@/components/tasks/task-bulk-checkbox";
import { BulkSelectionProvider } from "@/lib/use-bulk-selection";
import { cn } from "@/lib/utils";
import { TaskTableRow } from "./task-table-row";

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
  const effectiveViewer: TaskNotesViewer =
    viewer ?? { id: "anon", role: "EMPLOYEE" };

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
      // Block 37: sort by category FIRST so the visual category bands
      // (showBand = current category differs from previous) draw exactly
      // one band per distinct category. Within a category, the existing
      // spotlight → priority → dueDate ordering is preserved. Null
      // categories fall to the end ("nulls: 'last'") so uncategorised
      // tasks form an implicit trailing group instead of splitting the
      // table.
      orderBy: [
        { category: { sort: "asc", nulls: "last" } },
        { isSpotlight: "desc" },
        { priority: "desc" },
        { dueDate: "asc" }
      ]
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
                  viewer={effectiveViewer}
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
            {tasks.map((t, idx) => (
              <TaskTableRow
                key={t.id}
                task={t}
                prevCategory={idx > 0 ? tasks[idx - 1].category : null}
                assignees={assignees}
                categorySuggestions={categorySuggestions}
                isAdmin={isAdmin}
                viewer={effectiveViewer}
                now={now}
              />
            ))}
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
