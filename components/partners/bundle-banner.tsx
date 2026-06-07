"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home,
  Sparkles,
  Send,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import {
  generateBundleLead,
  type BundleLeadResult
} from "@/app/actions/partner-leads";

// Block 44 — "Form 4 Bundle" banner. Sits below the marketplace hero.
// When a client is close to Form 4 and needs to wire internet / gas /
// cleaning / etc. all at once, they hit this card and the system fans
// out a single-click multi-supplier request. Fully brand-styled —
// Charcoal headline, Signal Orange CTA, gold trim to echo the
// "featured supplier" gold treatment.

export type BundleBannerPermitOption = {
  id: string;
  label: string;
};

export function BundleBanner({
  permitOptions
}: {
  permitOptions: BundleBannerPermitOption[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/40 px-5 py-5 shadow-sm sm:px-7 sm:py-6 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-amber-500/10">
      <div
        className="pointer-events-none absolute -bottom-12 -end-10 size-44 rounded-full bg-amber-400/20 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Home className="size-3" />
            חבילת כניסה לבית
          </div>
          <h2 className="text-[18px] font-bold leading-tight text-[#1F2937] sm:text-[20px] dark:text-foreground">
            מתקרבים לטופס 4? סוגרים הכל בלחיצה אחת!
          </h2>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground sm:text-[13px]">
            שלחו פנייה מרוכזת לכל ספקי הגמר והכניסה לבית (אינטרנט, גז,
            ניקיון ועוד) וקבלו את ההטבות שלנו.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={permitOptions.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#E25822] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#C44A1B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="size-3.5" />
          בקש חבילת שירותים
        </button>
      </div>

      {open && (
        <BundleDialog
          permitOptions={permitOptions}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function BundleDialog({
  permitOptions,
  onClose
}: {
  permitOptions: BundleBannerPermitOption[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [permitId, setPermitId] = useState<string>(permitOptions[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BundleLeadResult | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  async function onSubmit() {
    if (!permitId) return;
    setPending(true);
    setResult(null);
    const res = await generateBundleLead({
      permitId,
      categoryName: "כניסה לבית"
    });
    setResult(res);
    setPending(false);
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <div className="flex items-center justify-between border-b-2 border-[#E25822] bg-[#F5F1E8] px-3 py-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1F2937]">
          <Home className="size-3.5" />
          חבילת כניסה לבית
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-0.5 text-[#4A5562] hover:bg-black/5"
          aria-label="סגור"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        {!result && (
          <>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              נשלח לכל ספקי הקטגוריה &quot;כניסה לבית&quot; פנייה ברורה עם
              פרטי הפרויקט. כל ספק שיענה ייצור איתך קשר ישירות.
            </p>

            {permitOptions.length > 1 && (
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-medium">
                  לאיזה פרויקט?
                </span>
                <select
                  value={permitId}
                  onChange={(e) => setPermitId(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {permitOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                disabled={pending}
                className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={pending || !permitId}
                className="inline-flex items-center gap-1.5 rounded bg-[#E25822] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#C44A1B] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Send className="size-3" />
                )}
                שלח פנייה לכולם
              </button>
            </div>
          </>
        )}

        {result?.ok && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded border border-emerald-500/40 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle2 className="size-4 shrink-0" />
              <div>
                <div className="font-semibold">הבקשות נשלחו בהצלחה!</div>
                <div className="text-[11px]">
                  הספקים ייצרו איתך קשר. {result.succeeded}/{result.requested}{" "}
                  פניות נוצרו במערכת.
                </div>
              </div>
            </div>
            {result.failed > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-500/5 dark:text-amber-200">
                {result.failed} פניות נכשלו ולא נשלחו — צוות מקובצקי יבדוק
                ויחזור אליך אם צריך.
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
              >
                סגור
              </button>
            </div>
          </div>
        )}

        {result && !result.ok && (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-900 dark:text-red-200">
              <AlertCircle className="size-4 shrink-0" />
              <div>
                <div className="font-semibold">הפנייה נכשלה</div>
                <div className="text-[11px]">{result.error}</div>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                }}
                className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
              >
                חזור
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
