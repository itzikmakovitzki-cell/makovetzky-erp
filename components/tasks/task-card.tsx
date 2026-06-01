import { Star, Building2, Loader2 } from "lucide-react";
import { ProjectTag } from "@/components/tasks/project-tag";
import { DueBadge } from "@/components/tasks/due-badge";
import { SnoozeBadge } from "@/components/tasks/snooze-badge";
import { TaskTitle } from "@/components/tasks/task-title";
import { WhatsAppReminderButton } from "@/components/tasks/whatsapp-reminder-button";
import { AssigneeAvatar } from "@/components/tasks/assignee-avatar";
import { projectColor } from "@/lib/project-color";
import { cn } from "@/lib/utils";
import type { MyTask } from "@/components/tasks/my-tasks-types";

// Rich draggable Kanban card. Presentational — the board wires up drag events
// on the wrapping element and passes `pending` while a move is in flight.
export function TaskCard({
  task,
  pending,
  className
}: {
  task: MyTask;
  pending?: boolean;
  className?: string;
}) {
  const color = projectColor(task.permitId);
  const isCompleted = task.status === "COMPLETED";
  return (
    <div
      className={cn(
        "select-none rounded-lg border border-s-4 bg-card p-2 shadow-sm transition hover:shadow-md",
        color.bar,
        pending && "opacity-50",
        isCompleted && "task-completed",
        className
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <ProjectTag permitId={task.permitId} name={task.permitName} className="max-w-[10rem]" />
        <div className="flex shrink-0 items-center gap-1">
          {pending && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          {task.isSpotlight && (
            <Star className="size-3 fill-yellow-500 text-yellow-500" aria-label="Spotlight" />
          )}
        </div>
      </div>

      <div className="task-name mb-1 line-clamp-2 text-[12px] font-medium leading-snug">
        <TaskTitle name={task.name} />
      </div>

      <div className="mb-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Building2 className="size-2.5 shrink-0" />
        <span className="truncate">{task.clientName}</span>
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <DueBadge date={task.dueDate} state={task.dueState} />
          <SnoozeBadge count={task.snoozeCount} />
        </div>
        <div className="flex items-center gap-1">
          {task.priority === "URGENT" && (
            <span className="rounded bg-red-500/10 px-1 py-0.5 text-[9px] font-semibold text-red-700">
              דחוף
            </span>
          )}
          <WhatsAppReminderButton
            assigneeName={task.assigneeName}
            phone={task.assigneePhone}
            taskName={task.name}
            projectName={task.permitName}
          />
          <AssigneeAvatar name={task.assigneeName} />
        </div>
      </div>
    </div>
  );
}
