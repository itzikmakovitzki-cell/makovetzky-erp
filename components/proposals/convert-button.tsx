"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftCircle, Loader2 } from "lucide-react";
import { convertProposalToProject } from "@/app/actions/proposals";

export function ConvertButton({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConvert = () => {
    if (
      !window.confirm(
        "להמיר את ההצעה לפרויקט פעיל? פעולה זו תיצור לקוח חדש, עסקה ואבני דרך לתשלום במערכת."
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await convertProposalToProject(proposalId);
      if (!res.ok) {
        setError(res.error ?? "שגיאה לא צפויה");
        return;
      }
      if (res.data?.clientId) {
        router.push(`/clients/${res.data.clientId}`);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleConvert}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded border border-emerald-700 bg-emerald-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ArrowLeftCircle className="size-3.5" />
        )}
        המר לפרויקט פעיל
      </button>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
