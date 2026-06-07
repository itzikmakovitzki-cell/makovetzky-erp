"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { reopenProposalForEdit } from "@/app/actions/proposals";

// Surfaced on the proposal detail page next to the existing "ערוך" / share
// affordances when status === SENT (or REJECTED, since admin may want to
// revise and re-send a declined proposal). Confirms before submitting
// because reopening clears the sentAt / expiresAt / reminder lifecycle
// stamps — the trail isn't lost (full STATUS_CHANGE audit row is written)
// but the current display state visibly resets.

export function ReopenProposalButton({
  proposalId,
  customerName
}: {
  proposalId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `לפתוח מחדש את ההצעה של ${customerName} לעריכה?\n\nסטטוס יחזור ל"טיוטה". לאחר העריכה תוכל לשתף מחדש — קישור החתימה (cuid) נשמר.`
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const res = await reopenProposalForEdit(proposalId);
            if (!res.ok) {
              setError(res.error || "שגיאה");
              return;
            }
            router.push(`/proposals/${proposalId}/edit`);
          });
        }}
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent disabled:opacity-50"
      >
        <Pencil className="size-2.5" />
        {pending ? "פותח..." : "פתח לעריכה"}
      </button>
      {error && (
        <span className="text-[10px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
