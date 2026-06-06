"use client";

import { AlertCircle, ArrowDownCircle, CheckCircle2 } from "lucide-react";

// Block 39 — "Next action" banner pinned to the top of the portal permit
// page so the contractor knows what's holding the project before they
// scroll. Two states:
//
//   * has open task     — destructive red alert + "טפל עכשיו" button that
//                          scrolls and focuses the row anchor on the task.
//   * nothing open      — subtle green "הכל מעודכן" pat-on-the-back.
//
// The component is intentionally client-only because the click handler
// needs scrollIntoView + an opt-in pulse animation. All data flows from
// the server-rendered page above it.

export type BlockerTask = {
  id: string;
  name: string;
} | null;

export function PortalBlockerAlert({ blocker }: { blocker: BlockerTask }) {
  if (!blocker) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
        <CheckCircle2 className="size-4 shrink-0" />
        <span>
          <strong className="font-semibold">הכל מעודכן!</strong> אין פעולות פתוחות
          עבורך כרגע. ברגע שמשהו ימתין לטיפולך — הוא יקפוץ לכאן.
        </span>
      </div>
    );
  }

  const handleScroll = () => {
    const el = document.getElementById(`portal-task-${blocker.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Single-shot highlight pulse so the eye lands on it even after the
    // scroll settles. Cleared via the same key on re-trigger.
    el.classList.remove("blocker-pulse");
    void el.offsetWidth; // force reflow so re-adding the class restarts it
    el.classList.add("blocker-pulse");
    window.setTimeout(() => el.classList.remove("blocker-pulse"), 2200);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-red-500/60 bg-red-50/70 px-3 py-2.5 text-[12px] text-red-900 shadow-sm dark:bg-red-500/10 dark:text-red-100">
      <AlertCircle className="size-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold">פעולה נדרשת</div>
        <div className="text-[11.5px] leading-snug">
          כדי שנוכל להתקדם, אנא השלם את המשימה — <strong>{blocker.name}</strong>
        </div>
      </div>
      <button
        type="button"
        onClick={handleScroll}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-red-700 bg-red-600 px-3 py-1 text-[11.5px] font-semibold text-white shadow-sm hover:bg-red-700"
      >
        <ArrowDownCircle className="size-3.5" />
        טפל עכשיו
      </button>
    </div>
  );
}
