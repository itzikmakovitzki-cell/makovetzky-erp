"use client";

import { useState } from "react";
import {
  Upload,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  FileText,
  ExternalLink,
  Circle,
  MessageSquare,
  ChevronDown,
  ChevronLeft
} from "lucide-react";
import type { TaskResponsibility, TaskStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  TASK_RESPONSIBILITY_LABEL,
  TASK_RESPONSIBILITY_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { formatDate } from "@/lib/utils";
import { PortalUploadDialog } from "./portal-upload-dialog";
import {
  TaskNotesPanel,
  type TaskNoteItem,
  type TaskNotesViewer
} from "@/components/tasks/task-notes-panel";
import { GenerateFormButton } from "@/components/tasks/generate-form-button";

export type PortalTaskDoc = {
  id: string;
  fileName: string;
  previewUrl: string | null;
  uploadedAt: string;
};

export type PortalTaskRowData = {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  isOverdue: boolean;
  needsAttention: boolean;
  responsibility: TaskResponsibility | null;
  documents: PortalTaskDoc[];
  // Block 30: contractors now see all tasks for a permit, but read-only
  // on those not assigned to them. When false → upload button hidden +
  // visual dim. Defaults to true so admin / direct-assignee rendering
  // is unchanged.
  isReadOnly?: boolean;
  // Block 34: progress notes log. Already ordered newest-first by the
  // page query.
  notes: TaskNoteItem[];
};

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  OPEN: Circle,
  IN_PROGRESS: Hourglass,
  AWAITING_AUTHORITY: Hourglass,
  COMPLETED: CheckCircle2,
  BLOCKED: AlertTriangle
};

export function PortalTaskRow({
  task,
  permitId,
  permitLocked,
  viewer
}: {
  task: PortalTaskRowData;
  permitId: string;
  permitLocked: boolean;
  viewer: TaskNotesViewer;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const Icon = STATUS_ICON[task.status];
  const canUpload = !permitLocked && task.status !== "COMPLETED" && !task.isReadOnly;
  const latestNote = task.notes[0] ?? null;

  return (
    <li
      id={`portal-task-${task.id}`}
      className={
        task.isReadOnly
          ? "rounded-md border border-dashed bg-muted/20 p-3 opacity-75"
          : task.needsAttention
            ? "rounded-md border border-amber-500/50 bg-amber-50/50 p-3 dark:bg-amber-500/5"
            : "rounded-md border bg-card p-3"
      }
    >
      <div className="flex items-start gap-2">
        <Icon
          className={
            task.status === "BLOCKED"
              ? "size-4 shrink-0 text-red-600"
              : task.status === "COMPLETED"
                ? "size-4 shrink-0 text-emerald-600"
                : task.status === "AWAITING_AUTHORITY"
                  ? "size-4 shrink-0 text-amber-600"
                  : "size-4 shrink-0 text-muted-foreground"
          }
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[13px] font-medium">{task.name}</span>
            <Badge variant={TASK_STATUS_VARIANT[task.status]}>
              {TASK_STATUS_LABEL[task.status]}
            </Badge>
            {task.responsibility && (
              <Badge variant={TASK_RESPONSIBILITY_VARIANT[task.responsibility]}>
                {TASK_RESPONSIBILITY_LABEL[task.responsibility]}
              </Badge>
            )}
            {task.isOverdue && (
              <span className="rounded border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300">
                באיחור
              </span>
            )}
            {task.needsAttention && !task.isReadOnly && (
              <span className="rounded border border-amber-500/50 bg-amber-100/60 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                דורש את תשומת ליבך
              </span>
            )}
            {task.isReadOnly && (
              <span className="rounded border border-muted-foreground/30 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                לצפייה בלבד
              </span>
            )}
          </div>

          {task.description && (
            <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
              {task.description}
            </div>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            {task.dueDate && <span>תאריך יעד: {formatDate(task.dueDate)}</span>}
            <span>{task.documents.length} מסמכים</span>
          </div>

          {task.documents.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {task.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-1.5 text-[11px]">
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  {d.previewUrl ? (
                    <a
                      href={d.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:underline"
                    >
                      <span className="truncate">{d.fileName}</span>
                      <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="truncate">{d.fileName}</span>
                  )}
                  <span className="ms-auto text-[9px] text-muted-foreground">{formatDate(d.uploadedAt)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Block 34 — progress notes log. Collapsed by default so the
              timeline stays scannable; click to expand the full thread and
              add a new entry. */}
          <div className="mt-2 border-t border-dashed pt-2">
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              aria-expanded={notesOpen}
            >
              {notesOpen ? (
                <ChevronDown className="size-3 shrink-0" />
              ) : (
                <ChevronLeft className="size-3 shrink-0" />
              )}
              <MessageSquare className="size-3 shrink-0" />
              <span className="font-medium">
                הערות{task.notes.length > 0 ? ` (${task.notes.length})` : ""}
              </span>
              {!notesOpen && latestNote && (
                <span className="min-w-0 truncate text-muted-foreground/80">
                  · {latestNote.authorName ?? "—"}: {latestNote.content}
                </span>
              )}
            </button>
            {notesOpen && (
              <div className="mt-2">
                <TaskNotesPanel
                  taskId={task.id}
                  notes={task.notes}
                  viewer={viewer}
                  emptyHint="עוד אין הערות במשימה זו. כתוב את הראשונה."
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-1">
          {/* Block 40 — Magic button. Visible for any task that isn't
              completed, regardless of read-only state — the form is
              useful for the contractor to print even when they can't
              modify the task. */}
          {task.status !== "COMPLETED" && (
            <GenerateFormButton taskId={task.id} taskName={task.name} variant="labeled" />
          )}
          {canUpload && (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
            >
              <Upload className="size-3" />
              <span className="hidden sm:inline">העלה מסמך</span>
            </button>
          )}
        </div>
      </div>

      {uploadOpen && (
        <PortalUploadDialog
          permitId={permitId}
          taskId={task.id}
          taskName={task.name}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </li>
  );
}
