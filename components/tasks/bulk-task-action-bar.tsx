"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ListChecks,
  Loader2,
  Trash2,
  UserPlus2,
  X
} from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { TASK_STATUS_LABEL } from "@/lib/status-maps";
import {
  bulkDeleteTasks,
  bulkUpdateTaskAssignee,
  bulkUpdateTaskStatus
} from "@/app/actions/tasks-bulk";
import { cn } from "@/lib/utils";

type AssigneeOption = { id: string; name: string };

// Order matches the legend on the tasks table so the dropdown reads top-down
// the way the user already thinks about workflow progression.
const STATUS_ORDER: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "COMPLETED",
  "BLOCKED"
];

// Floating action bar — sticks to the top of the scrolling <main> region so
// it stays in view as the user scrolls the long task list. Renders nothing
// when the selection is empty (no visual noise on the cold-start page).
export function BulkTaskActionBar({
  users,
  canDelete
}: {
  users: AssigneeOption[];
  // Only admins can bulk-delete; matches the per-row deleteTask gate.
  canDelete: boolean;
}) {
  const { count, selectedIds, clear } = useBulkSelection();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (count === 0) return null;

  // Centralizes the "run a bulk action and refresh" dance — every dropdown
  // item routes through this so the busy state + error surface are uniform.
  const runBulk = (op: () => Promise<{ ok: boolean; error: string | null; affected: number }>) => {
    setError(null);
    startTransition(async () => {
      const result = await op();
      if (!result.ok) {
        setError(result.error ?? "פעולה קבוצתית נכשלה");
        return;
      }
      clear();
      router.refresh();
    });
  };

  return (
    <div className="sticky top-2 z-40 mx-auto flex w-full max-w-3xl flex-col gap-1 px-2">
      <div className="flex flex-wrap items-center gap-2 rounded-full border border-foreground/20 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background">
          <span className="tabular-nums">{count}</span>
          <span>נבחרו</span>
        </span>

        {/* Assign */}
        <DropdownMenu align="start">
          <DropdownMenuTrigger
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <UserPlus2 className="size-3.5" />
            שייך ל…
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[14rem] max-h-[60vh] overflow-y-auto">
            <DropdownMenuLabel>אחראי</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() =>
                runBulk(() => bulkUpdateTaskAssignee(selectedIds, null))
              }
            >
              ללא משויך
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {users.map((u) => (
              <DropdownMenuItem
                key={u.id}
                onSelect={() =>
                  runBulk(() => bulkUpdateTaskAssignee(selectedIds, u.id))
                }
              >
                {u.name}
              </DropdownMenuItem>
            ))}
            {users.length === 0 && (
              <DropdownMenuItem disabled>אין משתמשים זמינים</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status */}
        <DropdownMenu align="start">
          <DropdownMenuTrigger
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            <ListChecks className="size-3.5" />
            שנה סטטוס…
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[12rem]">
            <DropdownMenuLabel>סטטוס חדש</DropdownMenuLabel>
            {STATUS_ORDER.map((s) => (
              <DropdownMenuItem
                key={s}
                icon={
                  s === "COMPLETED" ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                  ) : undefined
                }
                onSelect={() => {
                  // Bulk COMPLETED skips the per-task cascades (billing
                  // milestone promotion, permit progress%) that the single-
                  // task status change applies — warn so the PM isn't
                  // surprised when nothing downstream moves.
                  if (
                    s === "COMPLETED" &&
                    !window.confirm(
                      `לסמן ${count} משימות כהושלמו? שים לב: עדכון קבוצתי לא מקדם אבני דרך לתשלום או אחוז התקדמות ההיתר — אלה יעודכנו רק בעריכה פרטנית.`
                    )
                  ) {
                    return;
                  }
                  runBulk(() => bulkUpdateTaskStatus(selectedIds, s));
                }}
              >
                {TASK_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Delete (admin only) */}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  `למחוק ${count} משימות? הפעולה תעביר אותן לסל המחזור.`
                )
              ) {
                return;
              }
              runBulk(() => bulkDeleteTasks(selectedIds));
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-500/50 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-800 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
          >
            <Trash2 className="size-3.5" />
            מחק
          </button>
        )}

        <span className="ms-auto flex items-center gap-1">
          {pending && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="נקה בחירה"
          >
            <X className="size-3.5" />
            נקה
          </button>
        </span>
      </div>

      {error && (
        <div
          role="alert"
          className={cn(
            "mx-auto rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-800 shadow-sm dark:text-red-300"
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
}
