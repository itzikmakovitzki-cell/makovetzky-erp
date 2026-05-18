import Link from "next/link";
import { Hourglass, Lock, Star, User } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

// Mirror of the include shape in app/(dashboard)/tasks/page.tsx so the card
// can be rendered straight from the page query result.
export type TaskMobileCardData = Prisma.TaskGetPayload<{
  include: {
    assignee: { select: { id: true; name: true } };
    permit: { select: { id: true; name: true; permitNumber: true } };
    dependsOn: {
      select: {
        overriddenByAdmin: true;
        dependsOn: { select: { id: true; name: true; status: true } };
      };
    };
  };
}>;

export function TaskMobileCard({ task, now }: { task: TaskMobileCardData; now: Date }) {
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
    <Link
      href={`/permits/${task.permit.id}/tasks`}
      className="block transition-colors active:bg-muted/40"
      aria-label={`${task.permit.name} — ${task.name}`}
    >
      <Card className="relative overflow-hidden">
        <span
          className={cn("absolute inset-y-0 start-0 w-1", stripeColor)}
          aria-hidden
        />
        <CardHeader>
          <div className="min-w-0 flex-1 ps-2">
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
                {task.name}
              </h3>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {task.permit.name}
              {task.permit.permitNumber && (
                <span className="font-mono"> · {task.permit.permitNumber}</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={TASK_STATUS_VARIANT[task.status]}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
            {task.frozen && (
              <Hourglass className="size-3 text-amber-600" aria-label="מוקפא" />
            )}
          </div>
        </CardHeader>

        <CardContent className="ps-5 text-[11px] text-muted-foreground">
          {(task.category || task.responsibility || task.tags.length > 0) && (
            <div className="flex flex-wrap items-center gap-1">
              {task.responsibility && (
                <Badge variant={TASK_RESPONSIBILITY_VARIANT[task.responsibility]}>
                  {TASK_RESPONSIBILITY_LABEL[task.responsibility]}
                </Badge>
              )}
              {task.category && (
                <span className="text-[10px] text-muted-foreground">{task.category}</span>
              )}
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-muted px-1 py-0 text-[10px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{task.tags.length - 3}
                </span>
              )}
            </div>
          )}
          {isBlockedByDeps && (
            <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-1">
                חסום ע"י: {unmetDeps.map((d) => d.dependsOn.name).join(", ")}
              </span>
            </div>
          )}
        </CardContent>

        <CardFooter className="ps-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "tabular-nums text-[11px]",
                isOverdue ? "font-semibold text-red-600" : "text-muted-foreground",
                task.frozen && !isOverdue && "text-amber-700"
              )}
            >
              {task.dueDate ? formatDate(task.dueDate) : "ללא יעד"}
              {isOverdue && <span className="ms-1 text-[10px]">איחור</span>}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="size-3" />
              {task.assignee?.name ?? "לא משויך"}
            </span>
          </div>
          {task.priority === "URGENT" && (
            <Badge variant="destructive">דחוף</Badge>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
