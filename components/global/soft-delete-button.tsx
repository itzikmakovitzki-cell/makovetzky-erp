"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Reusable button that triggers a soft-delete server action and shows
// a confirm dialog. The action receives just the entity id; the parent
// page handles the revalidation.
//
// Variant "icon" is for inline use inside dense tables (just an X-circle).
// Variant "button" gets a label, used in headers and detail pages.
// Server actions are migrating from "throws on failure" to a structured
// { ok, error? } shape (Block 20). This button tolerates either — old
// actions return undefined on success, new ones return { ok: true }.
type DeleteActionResult = void | { ok: boolean; error?: string | null };

export function SoftDeleteButton({
  action,
  id,
  label,
  variant = "button",
  buttonLabel = "מחק"
}: {
  action: (id: string) => Promise<DeleteActionResult>;
  id: string;
  label: string;
  variant?: "icon" | "button";
  buttonLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClick = () => {
    setErrorMsg(null);
    const confirmed = window.confirm(
      `למחוק את "${label}"?\n\nהפריט יעבור לסל המחזור וניתן יהיה לשחזר אותו מ-הגדרות → סל המחזור.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      try {
        const result = await action(id);
        if (result && typeof result === "object" && result.ok === false) {
          const msg = result.error ?? "שגיאה";
          window.alert(msg);
          setErrorMsg(msg);
        }
      } catch (e) {
        // Old-style throwing actions still flow through here.
        const msg = e instanceof Error ? e.message : "שגיאה";
        window.alert(msg);
        setErrorMsg(msg);
      }
    });
  };

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        title={errorMsg ?? "מחק לסל המחזור"}
        className={cn(
          "inline-flex items-center justify-center rounded p-0.5 text-red-700/70 opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-700 group-hover:opacity-100 focus:opacity-100 dark:text-red-300/70 dark:hover:text-red-300",
          pending && "cursor-not-allowed opacity-100"
        )}
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={errorMsg ?? undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
        pending && "cursor-not-allowed opacity-50"
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Trash2 className="size-3" />
      )}
      {buttonLabel}
    </button>
  );
}
