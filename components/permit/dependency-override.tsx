"use client";

import { useTransition } from "react";
import { Unlock } from "lucide-react";
import { overrideTaskDependency } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

export function DependencyOverride({
  taskId,
  dependsOnTaskId,
  dependsOnName
}: {
  taskId: string;
  dependsOnTaskId: string;
  dependsOnName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          `לעקוף את התלות "${dependsOnName}"?\n\n` +
            "הפעולה תאפשר להתחיל לעבוד על המשימה למרות שהתלות לא הושלמה.\n" +
            "הפעולה תתועד ב-Audit Log עם שם המנהל ושעת השינוי."
        );
        if (!confirmed) return;
        startTransition(() => {
          void overrideTaskDependency(taskId, dependsOnTaskId);
        });
      }}
      className={cn(
        "inline-flex items-center gap-0.5 rounded border border-amber-500/50 bg-amber-500/10 px-1 py-0 text-[9px] font-medium leading-tight text-amber-800 hover:bg-amber-500/20 dark:text-amber-300",
        pending && "opacity-50"
      )}
      title="עקיפת תלות (Managerial Bypass)"
    >
      <Unlock className="size-2.5" />
      עקוף
    </button>
  );
}
