"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { rejectProposal, signProposal } from "@/app/actions/proposals-public";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

// All client-side controls on the public /quote/[id] page: sign or reject.
export function SignAndReject({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [signedName, setSignedName] = useState("");
  const [mode, setMode] = useState<"sign" | "reject">("sign");
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const name = signedName.trim();
    if (!name) {
      setError("יש להזין שם מלא לחתימה");
      return;
    }
    const signatureData = padRef.current?.toDataURL() ?? null;

    startTransition(async () => {
      const res = await signProposal(proposalId, {
        signedName: name,
        signatureData
      });
      if (!res.ok) {
        setError(res.error ?? "שגיאה לא צפויה");
        return;
      }
      router.refresh();
    });
  };

  const handleReject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await rejectProposal(proposalId, rejectReason);
      if (!res.ok) {
        setError(res.error ?? "שגיאה לא צפויה");
        return;
      }
      router.refresh();
    });
  };

  if (mode === "reject") {
    return (
      <form onSubmit={handleReject} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium">
            סיבת הדחייה (לא חובה)
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
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
            onClick={() => setMode("sign")}
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

  return (
    <form onSubmit={handleSign} className="space-y-3">
      <div>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium">
            השם המלא שלך <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            required
            maxLength={100}
            placeholder="ישראל ישראלי"
            className="w-full rounded border border-input bg-background px-2 py-1.5 text-[14px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-[12px] font-medium">
          חתימה (לא חובה אם הזנת שם)
        </span>
        <SignaturePad ref={padRef} />
        <p className="mt-1 text-[10px] text-muted-foreground">
          חתום באמצעות העכבר או האצבע
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => setMode("reject")}
          disabled={pending}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-red-600 disabled:opacity-50"
        >
          <XCircle className="size-3" />
          דחה הצעה
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded border border-emerald-600 bg-emerald-600 px-5 py-2 text-[14px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          אני מאשר ומסכים
        </button>
      </div>
    </form>
  );
}
