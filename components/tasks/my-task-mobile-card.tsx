import Link from "next/link";
import { Building2, Hourglass, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { TaskStatusControl } from "@/components/permit/task-status-control";
import { ProjectTag } from "@/components/tasks/project-tag";
import { InlineAssignee } from "@/components/tasks/inline-assignee";
import { InlineDueDate } from "@/components/tasks/inline-due-date";
import { SnoozeButton } from "@/components/tasks/snooze-button";
import { SnoozeBadge } from "@/components/tasks/snooze-badge";
import { TaskTitle } from "@/components/tasks/task-title";
import { WhatsAppReminderButton } from "@/components/tasks/whatsapp-reminder-button";
import { cn } from "@/lib/utils";
import type { MyTask, AssigneeOption } from "@/components/tasks/my-tasks-types";

export function MyTaskMobileCard({
  task,
  users
}: {
  task: MyTask;
  users: AssigneeOption[];
}) {
  const isCompleted = task.status === "COMPLETED";

  return (
    <Card className={cn(
      "overflow-hidden rounded-2xl border-white/80 bg-white/95 shadow-[0_8px_24px_rgba(31,41,55,0.07)]",
      task.dueState === "overdue" && !isCompleted && "border-red-200 border-s-4 border-s-red-500",
      task.dueState === "today" && !isCompleted && "border-s-4 border-s-primary",
      isCompleted && "opacity-60"
    )}>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
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
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <ProjectTag
              permitId={task.permitId}
              name={task.permitName}
              title={task.permitNumber ?? task.permitName}
            />
            <Link
              href={`/clients/${task.clientId}`}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <Building2 className="size-2.5" />
              {task.clientName}
            </Link>
          </div>
        </div>
        {task.priority === "URGENT" && <Badge variant="destructive">דחוף</Badge>}
      </CardHeader>

      <CardContent>
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
              assigneeId={task.assigneeId}
              users={users}
            />
            <WhatsAppReminderButton
              assigneeName={task.assigneeName}
              phone={task.assigneePhone}
              taskName={task.name}
              projectName={task.permitName}
            />
          </div>

          <span className="text-muted-foreground">יעד:</span>
          <div className="flex flex-col items-start gap-0.5">
            <div className="flex items-center gap-0.5">
              <InlineDueDate
                taskId={task.id}
                value={task.dueDate}
                isOverdue={task.dueState === "overdue"}
                frozen={task.frozen}
              />
              <SnoozeButton taskId={task.id} className="size-6" />
            </div>
            <SnoozeBadge count={task.snoozeCount} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
