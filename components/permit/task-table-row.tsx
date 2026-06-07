import { Fragment } from "react";
import { Lock, Hourglass } from "lucide-react";
import type { TaskResponsibility } from "@prisma/client";
import { deleteTask } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import type {
  TaskNoteItem,
  TaskNotesViewer
} from "@/components/tasks/task-notes-panel";
import { TaskQuickNotesTrigger } from "@/components/tasks/task-quick-notes-dialog";
import { GenerateFormButton } from "@/components/tasks/generate-form-button";
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
import { TaskEditButton } from "@/components/permit/task-edit-dialog";
import { TaskBulkCheckbox } from "@/components/tasks/task-bulk-checkbox";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT
} from "@/lib/status-maps";
import { cn } from "@/lib/utils";

// Shape of the rendered task row — kept loose (`any`-style structural typing
// via the field list) so TasksTable can pass its rich Prisma include shape
// directly without an intermediate mapping. The fields named here are the
// ones the row actually reads.
export type TaskTableRowTask = {
  id: string;
  name: string;
  description: string | null;
  status: import("@prisma/client").TaskStatus;
  priority: import("@prisma/client").TaskPriority;
  isSpotlight: boolean;
  frozen: boolean;
  snoozeCount: number;
  category: string | null;
  responsibility: TaskResponsibility | null;
  tags: string[];
  dueDate: Date | null;
  assignee: { id: string; name: string; phone: string | null } | null;
  template: { name: string } | null;
  permit: { name: string };
  dependsOn: Array<{
    overriddenByAdmin: boolean;
    dependsOn: {
      id: string;
      name: string;
      status: import("@prisma/client").TaskStatus;
    };
  }>;
  notes: Array<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    authorId: string | null;
    author: { name: string } | null;
  }>;
};

export type TaskAssigneeOption = { id: string; name: string };

export function TaskTableRow({
  task: t,
  prevCategory,
  assignees,
  categorySuggestions,
  isAdmin,
  viewer,
  now
}: {
  task: TaskTableRowTask;
  prevCategory: string | null;
  assignees: TaskAssigneeOption[];
  categorySuggestions: string[];
  isAdmin: boolean;
  viewer: TaskNotesViewer;
  now: Date;
}) {
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

  // Visual category grouping (PR-D of the polish sweep): insert a band row
  // before the first task of each new category. Tasks are sorted by
  // category-asc first (PR #34) so the iteration order does the grouping
  // for us. Uncategorised tasks (category null) skip the band.
  const showBand = !!t.category && t.category !== prevCategory;

  return (
    <Fragment>
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
            <TaskQuickNotesTrigger
              taskId={t.id}
              taskName={t.name}
              notes={t.notes.map(toNoteItem)}
              viewer={viewer}
            />
          </div>
        </td>
        <td className="p-0">
          <div className="flex items-center justify-center gap-0.5">
            {t.status !== "COMPLETED" && (
              <GenerateFormButton
                taskId={t.id}
                taskName={t.name}
                variant="compact"
              />
            )}
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
              viewer={viewer}
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
}

// Shape the Prisma row into the panel's serializable item (Dates → ISO
// strings so the prop crosses the client boundary cleanly).
type RawTaskNote = TaskTableRowTask["notes"][number];

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
