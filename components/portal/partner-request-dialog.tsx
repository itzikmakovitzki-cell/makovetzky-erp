"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, X, AlertCircle } from "lucide-react";
import {
  generatePartnerLead,
  type PartnerLeadResult
} from "@/app/actions/partner-leads";

// Block 30 (PR-C) — client wrapper for the "בקש שירות" CTA on
// /portal/partners and inside the back-office permit dashboard. Opens a
// modal that asks which permit the request is for (auto-selected when
// there's only one option) and calls generatePartnerLead. Channel results
// are rendered inline so the user sees exactly which transports actually
// fired.

export type PartnerRequestPermitOption = {
  id: string;
  label: string;
};

export function PartnerRequestDialog({
  supplierId,
  supplierName,
  permitOptions,
  forcedPermitId,
  triggerLabel = "בקש שירות",
  triggerVariant = "primary"
}: {
  supplierId: string;
  supplierName: string;
  permitOptions: PartnerRequestPermitOption[];
  // When the dialog is opened from a specific permit page (PM back-office)
  // pre-select that permit and hide the picker.
  forcedPermitId?: string;
  triggerLabel?: string;
  triggerVariant?: "primary" | "secondary";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [permitId, setPermitId] = useState<string>(
    forcedPermitId ?? permitOptions[0]?.id ?? ""
  );
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PartnerLeadResult | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (forcedPermitId) setPermitId(forcedPermitId);
  }, [forcedPermitId]);

  async function onSubmit() {
    if (!permitId) return;
    setPending(true);
    setResult(null);
    const res = await generatePartnerLead({ supplierId, permitId });
    setResult(res);
    setPending(false);
  }

  const disabled = pending || !permitId || permitOptions.length === 0;

  const triggerClass =
    triggerVariant === "primary"
      ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
      : "inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1 text-[12px] hover:bg-accent";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className={triggerClass}
        disabled={permitOptions.length === 0 && !forcedPermitId}
      >
        <Send className="size-3" />
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        onClose={() => setOpen(false)}
        className="w-[480px] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
      >
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5" dir="rtl">
          <h2 className="text-sm font-semibold">בקשת שירות — {supplierName}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3" dir="rtl">
          {result === null && (
            <>
              <p className="text-[12px] text-muted-foreground">
                נשלח לספק את פרטי הפרויקט והלקוח. הוא ייצור איתך קשר. הפנייה
                נכנסת ל-Outstanding שלנו אוטומטית.
              </p>

              {!forcedPermitId && (
                <label className="block">
                  <span className="mb-0.5 block text-[11px] font-medium">
                    איזה פרויקט?
                  </span>
                  <select
                    value={permitId}
                    onChange={(e) => setPermitId(e.target.value)}
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {permitOptions.length === 0 && (
                      <option value="">— אין פרויקטים זמינים —</option>
                    )}
                    {permitOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {result?.ok === true && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-50/50 px-2.5 py-2 text-[12px] text-emerald-800 dark:bg-emerald-500/5 dark:text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  הבקשה נשלחה לספק <strong>{result.supplierName}</strong>.
                </span>
              </div>
              <ul className="space-y-1 text-[11px]">
                <ChannelLine
                  label="WhatsApp"
                  sent={result.channels.whatsapp.sent}
                  reason={result.channels.whatsapp.reason}
                />
                <ChannelLine
                  label="אימייל"
                  sent={result.channels.email.sent}
                  reason={result.channels.email.reason}
                />
              </ul>
            </div>
          )}

          {result?.ok === false && (
            <div className="flex items-start gap-2 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-[12px] text-red-800 dark:text-red-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{result.error}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
          >
            {result?.ok ? "סגור" : "ביטול"}
          </button>
          {result === null && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {pending && <Loader2 className="size-3 animate-spin" />}
              שלח בקשה
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}

function ChannelLine({
  label,
  sent,
  reason
}: {
  label: string;
  sent: boolean;
  reason?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          sent
            ? "inline-block size-2 rounded-full bg-emerald-500"
            : "inline-block size-2 rounded-full bg-muted-foreground/40"
        }
      />
      <span className="font-medium">{label}:</span>
      <span className={sent ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
        {sent ? "נשלח" : (reason ?? "לא נשלח")}
      </span>
    </li>
  );
}
