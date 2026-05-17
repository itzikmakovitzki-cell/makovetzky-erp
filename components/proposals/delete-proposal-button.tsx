"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteProposal } from "@/app/actions/proposals";

export function DeleteProposalButton({
  proposalId,
  customerName,
  redirectTo
}: {
  proposalId: string;
  customerName: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    if (!window.confirm(`למחוק את ההצעה של "${customerName}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteProposal(proposalId);
      if (!res.ok) {
        setError(res.error ?? "שגיאה לא צפויה");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        title="מחק הצעה"
        className="inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-800 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
      >
        {pending ? (
          <Loader2 className="size-2.5 animate-spin" />
        ) : (
          <Trash2 className="size-2.5" />
        )}
        מחק
      </button>
      {error && (
        <span className="ms-2 text-[10px] text-red-700">{error}</span>
      )}
    </>
  );
}
