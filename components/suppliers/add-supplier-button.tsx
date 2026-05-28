"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { submitSupplier } from "@/app/actions/suppliers";

// ADMIN-only "ספק חדש" trigger + create dialog. Mirrors the building-types form
// pattern (useActionState + native <dialog>) so it inherits the same dense,
// keyboard-friendly behavior. Closes + revalidates the list on success.
export function AddSupplierButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
      >
        <Plus className="size-4" />
        ספק חדש
      </button>
      {open && <SupplierFormDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SupplierFormDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitSupplier, {
    error: null,
    ok: false
  });

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
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="w-[480px] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <form action={formAction} dir="rtl">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">ספק חדש</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          <Label text="שם הספק" required>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              autoFocus
              className={inputClass}
            />
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <Label text="סוג (למשל: מודד, מעבדה)">
              <input type="text" name="type" maxLength={80} className={inputClass} />
            </Label>
            <Label text="עמלת ברירת מחדל (₪)">
              <input
                type="number"
                name="defaultCommission"
                min={0}
                step="0.01"
                inputMode="decimal"
                className={inputClass}
              />
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Label text="איש קשר">
              <input type="text" name="contactName" maxLength={80} className={inputClass} />
            </Label>
            <Label text="טלפון">
              <input type="tel" name="phone" maxLength={40} className={inputClass} />
            </Label>
          </div>

          <Label text="אימייל">
            <input type="email" name="email" maxLength={120} className={inputClass} />
          </Label>

          <Label text="הערות">
            <textarea name="notes" rows={2} className={`${inputClass} resize-y`} />
          </Label>

          {state.error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isPending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שמור ספק
          </button>
        </div>
      </form>
    </dialog>
  );
}

const inputClass =
  "w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring";

function Label({
  text,
  required,
  children
}: {
  text: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium">
        {text} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
