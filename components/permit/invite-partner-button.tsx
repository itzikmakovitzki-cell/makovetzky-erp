"use client";

import { useEffect, useRef, useState } from "react";
import { Briefcase, X } from "lucide-react";
import { PartnerRequestDialog } from "@/components/portal/partner-request-dialog";

// Block 30 (PR-C) — back-office entry point. PM hits this on the permit
// dashboard ("הזמן ספק/שותף") while on a call with a client and picks a
// supplier from the public marketplace. Each row reuses the same
// PartnerRequestDialog component the client portal uses — same server
// action, same outcome reporting, no duplication of the channel result UX.

export type InvitePartnerSupplier = {
  id: string;
  name: string;
  type: string | null;
  marketingDescription: string | null;
};

export function InvitePartnerButton({
  permitId,
  permitLabel,
  suppliers
}: {
  permitId: string;
  permitLabel: string;
  suppliers: InvitePartnerSupplier[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1 text-[12px] hover:bg-accent"
      >
        <Briefcase className="size-3.5" />
        הזמן ספק/שותף
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        onClose={() => setOpen(false)}
        className="mk-dialog w-[640px] max-w-[calc(100vw-2rem)]"
      >
        <div
          className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5"
          dir="rtl"
        >
          <h2 className="text-sm font-semibold">
            הזמנת ספק/שותף — {permitLabel}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-3 py-3" dir="rtl">
          {suppliers.length === 0 ? (
            <p className="rounded-md border bg-muted/30 px-3 py-6 text-center text-[12px] text-muted-foreground">
              עוד לא הוגדרו ספקים פומביים. סמן ספק כ-&quot;פורסם ב-Partners
              Marketplace&quot; ב-/suppliers כדי שיופיע כאן.
            </p>
          ) : (
            <ul className="space-y-2">
              {suppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">{s.name}</div>
                    {s.type && (
                      <div className="text-[10px] text-muted-foreground">
                        {s.type}
                      </div>
                    )}
                    {s.marketingDescription && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {s.marketingDescription}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 self-center">
                    <PartnerRequestDialog
                      supplierId={s.id}
                      supplierName={s.name}
                      permitOptions={[{ id: permitId, label: permitLabel }]}
                      forcedPermitId={permitId}
                      triggerLabel="שלח בקשה"
                      triggerVariant="secondary"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
          >
            סגור
          </button>
        </div>
      </dialog>
    </>
  );
}
