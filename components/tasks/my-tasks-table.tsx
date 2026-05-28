import Link from "next/link";
import { Star, Hourglass, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

// Rich, Excel-like inbox table. Status / assignee / due-date cells edit inline.
export function MyTasksTable({
  tasks,
  users
}: {
  tasks: MyTask[];
  users: AssigneeOption[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          המשימות שלי ({tasks.length})
        </h2>
      </div>
      <table className="table-sticky-head">
        <thead>
          <tr>
            <th className="w-7"></th>
            <th>משימה</th>
            <th className="w-56">פרויקט / לקוח</th>
            <th className="w-36">סטטוס</th>
            <th className="w-36">אחראי</th>
            <th className="w-32">תאריך יעד</th>
            <th className="w-20">עדיפות</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                אין משימות תואמות — נסה לשנות את הסינון
              </td>
            </tr>
          )}
          {tasks.map((t) => {
            const isCompleted = t.status === "COMPLETED";
            return (
              <tr
                key={t.id}
                className={cn(
                  "group hover:bg-muted/50",
                  isCompleted && "task-completed"
                )}
              >
                <td className="text-center">
                  {t.isSpotlight && (
                    <Star
                      className="inline size-3 fill-yellow-500 text-yellow-500"
                      aria-label="Managerial Spotlight"
                    />
                  )}
                </td>
                <td>
                  <div className="font-medium">
                    <TaskTitle name={t.name} />
                  </div>
                </td>
                <td>
                  <div className="flex flex-col items-start gap-0.5">
                    <ProjectTag
                      permitId={t.permitId}
                      name={t.permitName}
                      title={t.permitNumber ?? t.permitName}
                    />
                    <Link
                      href={`/clients/${t.clientId}`}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      <Building2 className="size-2.5" />
                      {t.clientName}
                    </Link>
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
                  <div className="flex items-center gap-0.5">
                    <InlineAssignee
                      taskId={t.id}
                      assigneeId={t.assigneeId}
                      users={users}
                    />
                    <WhatsAppReminderButton
                      assigneeName={t.assigneeName}
                      taskName={t.name}
                      projectName={t.permitName}
                    />
                  </div>
                </td>
                <td>
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="flex items-center gap-0.5">
                      <InlineDueDate
                        taskId={t.id}
                        value={t.dueDate}
                        isOverdue={t.dueState === "overdue"}
                        frozen={t.frozen}
                      />
                      <SnoozeButton taskId={t.id} className="size-6" />
                    </div>
                    <SnoozeBadge count={t.snoozeCount} />
                  </div>
                </td>
                <td>
                  {t.priority === "URGENT" ? (
                    <Badge variant="destructive">דחוף</Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">רגיל</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
