"use client";

import { Hourglass, Lock, Star } from "lucide-react";
import type { Prisma, TaskResponsibility } from "@prisma/client";
import { deleteTask } from "@/app/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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

export type PermitTaskMobileData = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true; phone: true } };
    template: { select: { name: true } };
    permit: { select: { name: true } };
    dependsOn: {
      include: {
        dependsOn: { select: { id: true; name: true; status: true } };
      };
    };
  };
}>;

export function PermitTaskMobileCard({
  task,
  assignees,
  categorySuggestions,
  isAdmin,
  now
}: {
  task: PermitTaskMobileData;
  assignees: { id: string; name: string }[];
  categorySuggestions: string[];
  isAdmin: boolean;
  now: Date;
}) {
  const isCompleted = task.status === "COMPLETED";
  const isOverdue =
    !!task.dueDate && !task.frozen && !isCompleted && new Date(task.dueDate) < now;
  const unmetDeps = task.dependsOn.filter(
    (d) => d.dependsOn.status !== "COMPLETED" && !d.overriddenByAdmin
  );
  const isBlockedByDeps = !isCompleted && unmetDeps.length > 0;

  const stripeColor = isOverdue
    ? "bg-red-500"
    : task.frozen
      ? "bg-amber-500"
      : isBlockedByDeps || task.status === "BLOCKED"
        ? "bg-zinc-400"
        : "bg-transparent";

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        isCompleted && "opacity-60"
      )}
    >
      <span
        className={cn("absolute inset-y-0 start-0 w-1", stripeColor)}
        aria-hidden
      />
      <CardHeader>
        <div className="min-w-0 flex-1 ps-2">
          <div className="flex items-start gap-1.5">
            <TaskBulkCheckbox taskId={task.id} />
            <SpotlightToggle taskId={task.id} isSpotlight={task.isSpotlight} />
            {task.isSpotlight && (
              <Star
                className="mt-0.5 size-3.5 shrink-0 fill-yellow-500 text-yellow-500"
                aria-label="זרקור ניהולי"
              />
            )}
            <h3
              className={cn(
                "text-sm font-medium leading-snug text-foreground line-clamp-2",
                isCompleted && "line-through text-muted-foreground"
              )}
            >
              <TaskTitle name={task.name} />
            </h3>
          </div>
          {task.template && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              תבנית: {task.template.name}
            </p>
          )}
        </div>
        {task.priority === "URGENT" && <Badge variant="destructive">דחוף</Badge>}
      </CardHeader>

      <CardContent className="ps-5">
        {(task.category || task.responsibility || task.tags.length > 0) && (
          <Classification
            category={task.category}
            responsibility={task.responsibility}
            tags={task.tags}
          />
        )}

        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 text-[11px]">
          <span className="text-muted-foreground">סטטוס:</span>
          <div className="flex items-center gap-1">
            <TaskStatusControl taskId={task.id} currentStatus={task.status} />
            {task.frozen && (
              <Hourglass className="size-3 text-amber-600" aria-label="מוקפא" />
            )}
          </div>

          <span className="text-muted-foreground">אחראי:</span>
          <div className="flex items-center gap-0.5">
            <InlineAssignee
              taskId={task.id}
              assigneeId={task.assignee?.id ?? null}
              users={assignees}
            />
            <WhatsAppReminderButton
              assigneeName={task.assignee?.name ?? null}
              phone={task.assignee?.phone ?? null}
              taskName={task.name}
              projectName={task.permit.name}
            />
          </div>

          <span className="text-muted-foreground">יעד:</span>
          <div className="flex flex-col items-start gap-0.5">
            <InlineDueDate
              taskId={task.id}
              value={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null}
              isOverdue={isOverdue}
              frozen={task.frozen}
            />
            <SnoozeBadge count={task.snoozeCount} />
          </div>
        </div>

        {isBlockedByDeps && (
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded border border-zinc-300 bg-zinc-50 px-2 py-1 text-[11px] text-muted-foreground dark:bg-zinc-900/40">
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3 shrink-0" />
              <span>חסום ע&quot;י:</span>
            </span>
            {unmetDeps.map((d, i) => (
              <span key={d.dependsOn.id} className="inline-flex items-center gap-1">
                <span>{d.dependsOn.name}</span>
                <DependencyOverride
                  taskId={task.id}
                  dependsOnTaskId={d.dependsOn.id}
                  dependsOnName={d.dependsOn.name}
                />
                {i < unmetDeps.length - 1 && (
                  <span className="text-muted-foreground/50">·</span>
                )}
              </span>
            ))}
          </div>
        )}
        {task.frozen && !isBlockedByDeps && (
          <div className="text-[11px] text-muted-foreground">
            ממתין לתשובת רשות — תאריך יעד מוקפא
          </div>
        )}
      </CardContent>

      <CardFooter className="ps-5">
        <div className="flex items-center gap-0.5">
          <SnoozeButton taskId={task.id} />
          <TaskEditButton
            task={{
              id: task.id,
              name: task.name,
              description: task.description ?? "",
              category: task.category ?? "",
              responsibility: task.responsibility ?? "",
              tags: task.tags,
              dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "",
              priority: task.priority,
              assigneeId: task.assignee?.id ?? ""
            }}
            assignees={assignees}
            categorySuggestions={categorySuggestions}
          />
          <MagicLinkButton taskId={task.id} taskName={task.name} />
          {isAdmin && (
            <SoftDeleteButton
              action={deleteTask}
              id={task.id}
              label={task.name}
              variant="icon"
            />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function Classification({
  category,
  responsibility,
  tags
}: {
  category: string | null;
  responsibility: TaskResponsibility | null;
  tags: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {responsibility && (
        <Badge variant={TASK_RESPONSIBILITY_VARIANT[responsibility]}>
          {TASK_RESPONSIBILITY_LABEL[responsibility]}
        </Badge>
      )}
      {category && (
        <span className="text-[10px] text-muted-foreground">{category}</span>
      )}
      {tags.slice(0, 3).map((tag) => (
        <span
          key={tag}
          className="rounded bg-muted px-1 py-0 text-[10px] text-muted-foreground"
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-[10px] text-muted-foreground">
          +{tags.length - 3}
        </span>
      )}
    </div>
  );
}
