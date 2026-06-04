"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toggleAssignmentPaid } from "@/app/actions/supplier-assignments";

// Standalone mark-paid button for the outstanding-commissions flat list on
// /finances/supplier-commissions. Different from the supplier-detail row
// action — this one is a single-purpose "mark paid" affirmation, not a
// toggle. (The flat list only shows unpaid items, so untoggling here would
// remove the row anyway.)
export function MarkPaidButton({
  assignmentId
}: {
  assignmentId: string;
}) {
  const [pending, start] = useTransition();

  const handleClick = () => {
    if (!window.confirm("לסמן את העמלה כשולמה?")) return;
    start(async () => {
      const r = await toggleAssignmentPaid(assignmentId);
      if (!r.ok) window.alert(r.error);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded border border-emerald-600/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-200"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <CheckCircle2 className="size-3" />
      )}
      סמן כשולם
    </button>
  );
}
