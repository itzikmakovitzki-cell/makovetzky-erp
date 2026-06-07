"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X, UserPlus, PencilLine } from "lucide-react";
import {
  submitProjectContact,
  updateProjectContact,
  type ContactFormState
} from "@/app/actions/project-contacts";

// Block 33 — shared add / edit dialog for ProjectContact rows. Same shape
// used by /permits/[id]/contacts (back-office) and /portal/permit/[id]
// (contractor portal). The `mode` flips the bound server action and the
// submit-button copy; everything else stays the same so add/edit feels
// uniform across both surfaces.

export type ContactInitialValues = {
  id?: string;
  name?: string;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

const ROLE_SUGGESTIONS = [
  "אדריכל",
  "מפקח",
  "מהנדס קונסטרוקציה",
  "מהנדס אינסטלציה",
  "מהנדס חשמל",
  "מהנדס בטיחות",
  "מנהל עבודה",
  "קבלן שלד",
  "קבלן גמרים",
  "קבלן אלומיניום",
  "יועץ אקוסטיקה",
  "יועץ נגישות",
  "מודד"
];

export function ContactFormDialog({
  mode,
  permitId,
  initial,
  onClose
}: {
  mode: "create" | "edit";
  permitId: string;
  initial?: ContactInitialValues;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialState: ContactFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    mode === "edit" ? updateProjectContact : submitProjectContact,
    initialState
  );

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

  const Icon = mode === "edit" ? PencilLine : UserPlus;

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction} dir="rtl">
        <input type="hidden" name="permitId" value={permitId} />
        {mode === "edit" && initial?.id && (
          <input type="hidden" name="contactId" value={initial.id} />
        )}
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Icon className="size-3.5" />
            {mode === "edit" ? `עריכת ${initial?.name ?? "איש קשר"}` : "איש קשר חדש"}
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
          <div className="grid grid-cols-2 gap-3">
            <Label text="שם" required>
              <input
                type="text"
                name="name"
                required
                maxLength={120}
                defaultValue={initial?.name ?? ""}
                autoFocus={mode === "create"}
                className={inputClass}
              />
            </Label>
            <Label text="תפקיד" required>
              <input
                type="text"
                name="role"
                required
                list="contact-role-suggestions"
                maxLength={80}
                defaultValue={initial?.role ?? ""}
                placeholder="אדריכל, מפקח, מהנדס…"
                className={inputClass}
              />
              <datalist id="contact-role-suggestions">
                {ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Label text="טלפון" required>
              <input
                type="tel"
                name="phone"
                required
                maxLength={40}
                defaultValue={initial?.phone ?? ""}
                placeholder="050-1234567"
                className={inputClass}
              />
            </Label>
            <Label text="אימייל">
              <input
                type="email"
                name="email"
                maxLength={120}
                defaultValue={initial?.email ?? ""}
                className={inputClass}
              />
            </Label>
          </div>

          <Label text="הערות">
            <textarea
              name="notes"
              rows={2}
              defaultValue={initial?.notes ?? ""}
              placeholder='לדוגמה: "מגיע בימי ראשון בלבד"'
              className={`${inputClass} resize-y`}
            />
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
            {mode === "edit" ? "שמור שינויים" : "הוסף איש קשר"}
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
