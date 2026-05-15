"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X, Upload } from "lucide-react";
import { createPendingDocumentManual } from "@/app/actions/inbox";

export function ManualUploadDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(createPendingDocumentManual, {
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction} encType="multipart/form-data">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Upload className="size-3.5" />
            העלה מסמך לתיבה
          </h2>
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
          <Field label="קובץ" required>
            <input
              type="file"
              name="file"
              required
              className="block w-full text-[12px] file:me-2 file:rounded file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-[12px] file:font-medium file:text-foreground hover:file:bg-accent"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              עד 25 MB. PDF, תמונה, וכל סוג אחר.
            </span>
          </Field>

          <Field label="מי שלח (אופציונלי)">
            <input
              type="text"
              name="senderInfo"
              placeholder='לדוגמה: "WhatsApp — יוסי חשמלאי" או "מייל מהמודד"'
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              אם תשאיר ריק, יירשם &ldquo;הועלה ידנית ע&quot;י [שמך]&rdquo;.
            </span>
          </Field>

          <Field label="הערה / תוכן ההודעה (אופציונלי)">
            <textarea
              name="note"
              rows={3}
              placeholder='לדוגמה: "תוצאות בדיקת בטון לוילה 3 — עברו 100%"'
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

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
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            העלה
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
