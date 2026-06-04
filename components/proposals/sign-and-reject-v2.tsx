"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { rejectProposal, signProposal } from "@/app/actions/proposals";
import { normalizeIsraeliId, validateIsraeliId } from "@/lib/israeli-id";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";

// V2 public signing form for /quote/[id]. Requires full name + Israeli ID +
// canvas signature. The phone is shown read-only — it's the phone we already
// have on the proposal, and that's the number we record at signing time.
export function SignAndRejectV2({
  proposalId,
  proposalPhone
}: {
  proposalId: string;
  proposalPhone: string;
}) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [signedName, setSignedName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [mode, setMode] = useState<"sign" | "reject">("sign");
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [pending, startTransition] = useTransition();

  const idStatus = useMemo<"empty" | "valid" | "invalid">(() => {
    if (!idNumber.trim()) return "empty";
    return validateIsraeliId(idNumber) ? "valid" : "invalid";
  }, [idNumber]);

  const handleSign = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const name = signedName.trim();
    if (!name) {
      setError("יש להזין שם מלא לחתימה");
      return;
    }
    if (idStatus !== "valid") {
      setError("יש להזין מספר תעודת זהות תקין");
      return;
    }
    if (padRef.current?.isEmpty?.() ?? true) {
      setError("יש לחתום בריבוע החתימה");
      return;
    }
    const signatureData = padRef.current?.toDataURL() ?? null;

    startTransition(async () => {
      const res = await signProposal(proposalId, {
        signedName: name,
        signedIdNumber: normalizeIsraeliId(idNumber),
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
    <form onSubmit={handleSign} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium">
            שם מלא <span className="text-red-600">*</span>
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

        <label className="block">
          <span className="mb-1 block text-[12px] font-medium">
            תעודת זהות <span className="text-red-600">*</span>
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, ""))}
            required
            maxLength={9}
            placeholder="000000000"
            className={`w-full rounded border bg-background px-2 py-1.5 text-[14px] tabular-nums focus:outline-none focus:ring-1 ${
              idStatus === "invalid"
                ? "border-red-500 focus:ring-red-500"
                : idStatus === "valid"
                  ? "border-emerald-500 focus:ring-emerald-500"
                  : "border-input focus:ring-ring"
            }`}
          />
          {idStatus === "invalid" && (
            <span className="mt-0.5 block text-[10px] text-red-600">
              מספר תעודת הזהות אינו תקין
            </span>
          )}
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[12px] font-medium text-muted-foreground">
            טלפון לחתימה
          </span>
          <input
            type="text"
            value={proposalPhone}
            readOnly
            className="w-full cursor-not-allowed rounded border border-input bg-muted/40 px-2 py-1.5 text-[14px] text-muted-foreground tabular-nums"
          />
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            זה הטלפון המוקלד בהצעה; הוא נרשם בתיעוד החתימה. לא ניתן לערוך מכאן.
          </span>
        </label>
      </div>

      <div>
        <span className="mb-1 block text-[12px] font-medium">
          חתימה <span className="text-red-600">*</span>
        </span>
        <SignaturePad ref={padRef} />
        <p className="mt-1 text-[10px] text-muted-foreground">
          חתום באמצעות העכבר או האצבע. החתימה תוטמע בקובץ ה-PDF.
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
          אני מאשר וחותם על המסמך
        </button>
      </div>
    </form>
  );
}
