"use client";

import { useTransition } from "react";
import { CheckCircle2, Lock, Loader2, Undo2 } from "lucide-react";
import { markPermitCompleted, reopenPermit } from "@/app/actions/permits";

type Mode = "suggest-completion" | "locked";

export function CompletionBanner({
  permitId,
  mode,
  taskCompleted,
  taskTotal,
  isAdmin
}: {
  permitId: string;
  mode: Mode;
  taskCompleted: number;
  taskTotal: number;
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (mode === "suggest-completion") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/40 bg-emerald-50/60 px-3 py-2 dark:bg-emerald-500/5">
        <div className="flex items-center gap-2 text-[13px]">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>
            <span className="font-medium">כל המשימות הושלמו</span>
            <span className="text-muted-foreground"> ({taskCompleted}/{taskTotal}).</span>
            <span className="ms-1">לסגור את ההיתר?</span>
          </span>
        </div>
        {isAdmin ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await markPermitCompleted(permitId);
                } catch (e) {
                  alert(e instanceof Error ? e.message : "סגירת ההיתר נכשלה");
                }
              })
            }
            className="inline-flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-600 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            סגור היתר
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">סגירת היתר זמינה למנהל בלבד</span>
        )}
      </div>
    );
  }

  // mode === "locked"
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 dark:bg-amber-500/5">
      <div className="flex items-center gap-2 text-[13px]">
        <Lock className="size-4 shrink-0 text-amber-600" />
        <span>
          <span className="font-medium">היתר זה הושלם וננעל לעריכה.</span>
          <span className="ms-1 text-muted-foreground">תוכל לראות את הנתונים, אך לא לערוך אותם.</span>
        </span>
      </div>
      {isAdmin && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await reopenPermit(permitId);
              } catch (e) {
                alert(e instanceof Error ? e.message : "פתיחה מחדש נכשלה");
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded border border-amber-700 bg-amber-600 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Undo2 className="size-3" />}
          פתח מחדש
        </button>
      )}
    </div>
  );
}
