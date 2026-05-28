"use client";

import { useEffect, useState, useTransition } from "react";
import type { TaskStatus } from "@prisma/client";
import { updateTaskStatus } from "@/app/actions/tasks";
import { TaskCard } from "@/components/tasks/task-card";
import { TASK_STATUS_LABEL } from "@/lib/status-maps";
import { cn } from "@/lib/utils";
import type { MyTask } from "@/components/tasks/my-tasks-types";

const COLUMNS: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "BLOCKED",
  "COMPLETED"
];

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  OPEN: "border-t-foreground/30",
  IN_PROGRESS: "border-t-sky-400",
  AWAITING_AUTHORITY: "border-t-amber-400",
  BLOCKED: "border-t-zinc-400",
  COMPLETED: "border-t-emerald-400"
};

export function KanbanBoard({ tasks }: { tasks: MyTask[] }) {
  // Local mirror so cards move instantly on drop; resynced when the server
  // sends fresh data after revalidation.
  const [items, setItems] = useState<MyTask[]>(tasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const move = (taskId: string, to: TaskStatus) => {
    const current = items.find((t) => t.id === taskId);
    if (!current || current.status === to) return;
    const prevStatus = current.status;

    // Optimistic move — drag-to-COMPLETED also re-syncs financial milestones
    // server-side via updateTaskStatus → recalcPermitProgress.
    setItems((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: to } : t))
    );
    setPendingIds((prev) => new Set(prev).add(taskId));

    startTransition(async () => {
      try {
        await updateTaskStatus(taskId, to);
      } catch (e) {
        setItems((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: prevStatus } : t))
        );
        window.alert(e instanceof Error ? e.message : "שינוי הסטטוס נכשל");
      } finally {
        setPendingIds((prev) => {
          const n = new Set(prev);
          n.delete(taskId);
          return n;
        });
      }
    });
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colTasks = items.filter((t) => t.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col);
            }}
            onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain") || draggingId;
              if (id) move(id, col);
              setOverCol(null);
              setDraggingId(null);
            }}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/20 transition",
              overCol === col && "ring-2 ring-primary/40"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between rounded-t-lg border-b border-t-2 bg-card px-2 py-1.5",
                COLUMN_ACCENT[col]
              )}
            >
              <span className="text-[11px] font-semibold">
                {TASK_STATUS_LABEL[col]}
              </span>
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                {colTasks.length}
              </span>
            </div>
            <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
              {colTasks.length === 0 && (
                <div className="py-6 text-center text-[10px] text-muted-foreground">
                  גרור לכאן
                </div>
              )}
              {colTasks.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDraggingId(t.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverCol(null);
                  }}
                  className={cn(
                    "cursor-grab active:cursor-grabbing",
                    draggingId === t.id && "opacity-40"
                  )}
                >
                  <TaskCard task={t} pending={pendingIds.has(t.id)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
