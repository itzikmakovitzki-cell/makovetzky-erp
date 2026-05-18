"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, CheckCircle2, Plus, Loader2, Lock, Percent } from "lucide-react";
import type { MilestoneStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { MILESTONE_STATUS_LABEL, MILESTONE_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";
import { markMilestonePaid } from "@/app/actions/milestones";
import { MilestoneFormDialog, type DialogInitialValues } from "./milestone-form-dialog";

export type MilestoneRow = {
  id: string;
  permitId: string;
  name: string;
  amount: number;
  status: MilestoneStatus;
  dueDate: string | null;
  // Exactly one of triggerTaskId / triggerPercentage is set per milestone.
  triggerTaskId: string | null;
  triggerTaskName: string | null;
  triggerPercentage: number | null;
  notes: string | null;
};

type Mode =
  | { kind: "create" }
  | { kind: "update"; milestoneId: string };

const EMPTY_INITIAL: DialogInitialValues = {
  name: "",
  amount: "",
  triggerKind: "task",
  triggerTaskId: "",
  triggerPercentage: "",
  dueDate: "",
  notes: ""
};

export function MilestonesTableInteractive({
  permitId,
  milestones,
  allTasks,
  availableTasksForCreate,
  permitCompletionPct,
  permitCompletedCount,
  permitTotalCount,
  isAdmin
}: {
  permitId: string;
  milestones: MilestoneRow[];
  allTasks: { id: string; name: string }[];
  availableTasksForCreate: { id: string; name: string }[];
  permitCompletionPct: number;
  permitCompletedCount: number;
  permitTotalCount: number;
  isAdmin: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);

  const milestoneBeingEdited = useMemo(() => {
    if (!mode || mode.kind !== "update") return null;
    return milestones.find((m) => m.id === mode.milestoneId) ?? null;
  }, [mode, milestones]);

  const dialogConfig = useMemo(() => {
    if (!mode) return null;
    if (mode.kind === "create") {
      return {
        formMode: { kind: "create" as const, permitId },
        initial: EMPTY_INITIAL,
        tasks: availableTasksForCreate
      };
    }
    if (!milestoneBeingEdited) return null;
    // In edit mode, allow keeping the current task even though it's "used".
    const currentTask = milestoneBeingEdited.triggerTaskId
      ? allTasks.find((t) => t.id === milestoneBeingEdited.triggerTaskId) ?? null
      : null;
    const tasks = currentTask
      ? [currentTask, ...availableTasksForCreate.filter((t) => t.id !== currentTask.id)]
      : availableTasksForCreate;
    const initial: DialogInitialValues = {
      name: milestoneBeingEdited.name,
      amount: milestoneBeingEdited.amount,
      triggerKind:
        milestoneBeingEdited.triggerPercentage !== null ? "percentage" : "task",
      triggerTaskId: milestoneBeingEdited.triggerTaskId ?? "",
      triggerPercentage:
        milestoneBeingEdited.triggerPercentage !== null
          ? milestoneBeingEdited.triggerPercentage
          : "",
      dueDate: milestoneBeingEdited.dueDate
        ? milestoneBeingEdited.dueDate.slice(0, 10)
        : "",
      notes: milestoneBeingEdited.notes ?? ""
    };
    return {
      formMode: {
        kind: "update" as const,
        milestoneId: milestoneBeingEdited.id,
        permitId: milestoneBeingEdited.permitId
      },
      initial,
      tasks
    };
  }, [mode, milestoneBeingEdited, allTasks, availableTasksForCreate, permitId]);

  // Column count drives the empty-state colspan and is one less for non-admins
  // (the Actions column is omitted entirely rather than left empty).
  const columnCount = isAdmin ? 6 : 5;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          אבני דרך לחיוב ({milestones.length})
        </h2>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setMode({ kind: "create" })}
            disabled={availableTasksForCreate.length === 0}
            className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              availableTasksForCreate.length === 0
                ? "אין משימות פנויות לשיוך אבן דרך"
                : "הוסף אבן דרך חדשה"
            }
          >
            <Plus className="size-3" />
            הוסף אבן דרך
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Lock className="size-3" />
            תצוגה בלבד — פעולות פיננסיות שמורות לאדמין
          </span>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th>שם אבן דרך</th>
            <th className="w-28">סכום</th>
            <th>משימה מפעילה</th>
            <th className="w-24">תאריך יעד</th>
            <th className="w-24">סטטוס</th>
            {isAdmin && <th className="w-32">פעולות</th>}
          </tr>
        </thead>
        <tbody>
          {milestones.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="py-6 text-center text-xs text-muted-foreground">
                {isAdmin
                  ? "אין אבני דרך עדיין. הוסף את הראשונה למעלה."
                  : "אין אבני דרך."}
              </td>
            </tr>
          )}
          {milestones.map((m) => (
            <MilestoneRowComponent
              key={m.id}
              milestone={m}
              isAdmin={isAdmin}
              permitCompletionPct={permitCompletionPct}
              permitCompletedCount={permitCompletedCount}
              permitTotalCount={permitTotalCount}
              onEdit={() => setMode({ kind: "update", milestoneId: m.id })}
            />
          ))}
        </tbody>
      </table>

      {isAdmin && mode && dialogConfig && (
        <MilestoneFormDialog
          key={mode.kind === "update" ? `edit-${mode.milestoneId}` : "create"}
          mode={dialogConfig.formMode}
          initial={dialogConfig.initial}
          availableTasks={dialogConfig.tasks}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}

function MilestoneRowComponent({
  milestone,
  isAdmin,
  permitCompletionPct,
  permitCompletedCount,
  permitTotalCount,
  onEdit
}: {
  milestone: MilestoneRow;
  isAdmin: boolean;
  permitCompletionPct: number;
  permitCompletedCount: number;
  permitTotalCount: number;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isDue = milestone.status === "DUE";
  const isPaid = milestone.status === "PAID";
  const isPercentageBased = milestone.triggerPercentage !== null;
  const hasHitTarget =
    isPercentageBased &&
    permitCompletionPct >= (milestone.triggerPercentage ?? Number.POSITIVE_INFINITY);

  const handleMarkPaid = () => {
    startTransition(async () => {
      try {
        await markMilestonePaid(milestone.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      }
    });
  };

  return (
    <tr
      className={cn(
        "hover:bg-muted/30",
        isDue && "bg-amber-50/40 dark:bg-amber-500/5",
        isPaid && "text-muted-foreground"
      )}
    >
      <td>
        <div className={cn("font-medium", isPaid && "line-through")}>{milestone.name}</div>
        {milestone.notes && (
          <div className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
            {milestone.notes}
          </div>
        )}
      </td>
      <td
        className={cn(
          "text-end tabular-nums font-semibold",
          isDue && "text-amber-800 dark:text-amber-300",
          isPaid && "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {formatILS(milestone.amount)}
      </td>
      <td className="text-xs">
        {isPercentageBased ? (
          <PercentageProgress
            target={milestone.triggerPercentage as number}
            currentPct={permitCompletionPct}
            completedCount={permitCompletedCount}
            totalCount={permitTotalCount}
            hasHitTarget={hasHitTarget}
          />
        ) : (
          milestone.triggerTaskName ?? <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-xs tabular-nums">{formatDate(milestone.dueDate)}</td>
      <td>
        <Badge variant={MILESTONE_STATUS_VARIANT[milestone.status]}>
          {MILESTONE_STATUS_LABEL[milestone.status]}
        </Badge>
      </td>
      {isAdmin && (
        <td>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent disabled:opacity-50"
              title="ערוך אבן דרך"
            >
              <Pencil className="size-2.5" />
              ערוך
            </button>
            {!isPaid && (
              <button
                type="button"
                disabled={pending}
                onClick={handleMarkPaid}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                title="סמן כשולם"
              >
                {pending ? (
                  <Loader2 className="size-2.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-2.5" />
                )}
                שולם
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

// Mini progress bar used in the "trigger" cell for percentage-based milestones.
// Visually clamps current at 100% but keeps the numeric label honest.
function PercentageProgress({
  target,
  currentPct,
  completedCount,
  totalCount,
  hasHitTarget
}: {
  target: number;
  currentPct: number;
  completedCount: number;
  totalCount: number;
  hasHitTarget: boolean;
}) {
  const fillPct = Math.max(0, Math.min(100, currentPct));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[10px] font-medium">
        <Percent className="size-2.5 text-muted-foreground" />
        <span className="text-muted-foreground">יעד:</span>
        <span className="tabular-nums text-foreground">{target}%</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">כעת:</span>
        <span
          className={cn(
            "tabular-nums",
            hasHitTarget
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-foreground"
          )}
        >
          {currentPct}%
        </span>
        {hasHitTarget && (
          <span className="ms-1 rounded bg-emerald-500/15 px-1 py-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            לחיוב
          </span>
        )}
      </div>
      <div className="relative h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
        {/* Target line — a thin notch the current bar must reach. */}
        <span
          className="absolute inset-y-0 w-px bg-foreground/40"
          style={{ left: `${Math.min(100, target)}%` }}
          aria-hidden
        />
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            hasHitTarget ? "bg-emerald-500" : "bg-sky-500"
          )}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <div className="text-[9px] tabular-nums text-muted-foreground">
        {completedCount} / {totalCount} משימות הושלמו
      </div>
    </div>
  );
}
