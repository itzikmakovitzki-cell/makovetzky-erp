"use client";

import { Loader2 } from "lucide-react";

// Shared by both SignAndReject (v1) and SignAndRejectV2 — the rejection
// step is identical in both signing flows, only the signing step differs
// (v2 adds Israeli ID + mandatory canvas signature).
export function RejectProposalForm({
  rejectReason,
  onRejectReasonChange,
  onSubmit,
  onBack,
  pending,
  error
}: {
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[12px] font-medium">
          סיבת הדחייה (לא חובה)
        </span>
        <textarea
          value={rejectReason}
          onChange={(e) => onRejectReasonChange(e.target.value)}
          rows={3}
          placeholder="למשל: 'המחיר גבוה מהתקציב'"
          className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>
      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="text-[12px] text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          ← חזור
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          אשר דחייה
        </button>
      </div>
    </form>
  );
}
