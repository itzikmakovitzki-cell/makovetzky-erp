"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { SupplierCommissionType } from "@prisma/client";
import {
  submitSupplier,
  updateSupplier,
  type SupplierFormState
} from "@/app/actions/suppliers";
import { cn } from "@/lib/utils";

// Shared dialog body — used by both AddSupplierButton (create) and
// EditSupplierButton (update). The `mode` switches the bound server action
// and the submit-button copy; everything else stays the same so the field
// shape is consistent across both flows.

export type SupplierInitialValues = {
  id?: string;
  name?: string;
  type?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  services?: string | null;
  defaultCommissionType?: SupplierCommissionType | null;
  // Decimal serialises to a string when crossing the server/client boundary —
  // accept either to be safe.
  defaultCommissionValue?: string | number | null;
  defaultPaymentTerms?: string | null;
  notes?: string | null;
  isPublic?: boolean | null;
  marketingDescription?: string | null;
  logoUrl?: string | null;
};

export function SupplierFormDialog({
  mode,
  initial,
  typeSuggestions,
  onClose
}: {
  mode: "create" | "edit";
  initial?: SupplierInitialValues;
  typeSuggestions: string[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialState: SupplierFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    mode === "edit" ? updateSupplier : submitSupplier,
    initialState
  );

  // Local UI state for the commission type toggle so the value input adapts
  // its label/placeholder/max without a round-trip.
  const [commissionType, setCommissionType] =
    useState<SupplierCommissionType | "">(initial?.defaultCommissionType ?? "");

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
      className="w-[560px] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <form action={formAction} dir="rtl">
        {mode === "edit" && initial?.id && (
          <input type="hidden" name="supplierId" value={initial.id} />
        )}
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {mode === "edit" ? `עריכת ספק — ${initial?.name ?? ""}` : "ספק חדש"}
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
            <Label text="שם הספק" required>
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
            <Label text="סוג (למשל: מודד, מעבדה)">
              <input
                type="text"
                name="type"
                list="supplier-type-suggestions"
                maxLength={80}
                defaultValue={initial?.type ?? ""}
                className={inputClass}
              />
              <datalist id="supplier-type-suggestions">
                {typeSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Label>
          </div>

          <Label text='שירותים שהספק נותן (תיאור חופשי — "בדיקות חשמל ובניית ת.ת")'>
            <textarea
              name="services"
              rows={2}
              defaultValue={initial?.services ?? ""}
              className={`${inputClass} resize-y`}
            />
          </Label>

          <div className="grid grid-cols-2 gap-3">
            <Label text="איש קשר">
              <input
                type="text"
                name="contactName"
                maxLength={80}
                defaultValue={initial?.contactName ?? ""}
                className={inputClass}
              />
            </Label>
            <Label text="טלפון">
              <input
                type="tel"
                name="phone"
                maxLength={40}
                defaultValue={initial?.phone ?? ""}
                className={inputClass}
              />
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Label text="אימייל">
              <input
                type="email"
                name="email"
                maxLength={120}
                defaultValue={initial?.email ?? ""}
                className={inputClass}
              />
            </Label>
            <Label text="אתר אינטרנט">
              <input
                type="url"
                name="website"
                maxLength={200}
                placeholder="https://"
                defaultValue={initial?.website ?? ""}
                className={inputClass}
              />
            </Label>
          </div>

          {/* Commission: segmented pill + value. Empty state allowed (per-
              assignment values can override). */}
          <fieldset className="rounded border bg-muted/20 px-2 py-2">
            <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              עמלת ברירת מחדל
            </legend>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-0.5 text-[11px] font-medium">סוג</div>
                <div
                  role="radiogroup"
                  className="inline-flex items-center rounded-md border border-input bg-background p-0.5"
                >
                  <CommissionTypePill
                    label="—"
                    value=""
                    active={commissionType === ""}
                    onClick={() => setCommissionType("")}
                  />
                  <CommissionTypePill
                    label="סכום ₪"
                    value="FIXED"
                    active={commissionType === "FIXED"}
                    onClick={() => setCommissionType("FIXED")}
                  />
                  <CommissionTypePill
                    label="אחוז %"
                    value="PERCENT"
                    active={commissionType === "PERCENT"}
                    onClick={() => setCommissionType("PERCENT")}
                  />
                </div>
                {/* Hidden field carries the selected value to the server. */}
                <input
                  type="hidden"
                  name="defaultCommissionType"
                  value={commissionType}
                />
              </div>
              <Label
                text={
                  commissionType === "PERCENT"
                    ? "אחוז (0–100)"
                    : commissionType === "FIXED"
                      ? "סכום (₪)"
                      : "ערך"
                }
              >
                <input
                  type="number"
                  name="defaultCommissionValue"
                  min={0}
                  max={commissionType === "PERCENT" ? 100 : undefined}
                  step="0.01"
                  inputMode="decimal"
                  disabled={commissionType === ""}
                  defaultValue={
                    initial?.defaultCommissionValue
                      ? String(initial.defaultCommissionValue)
                      : ""
                  }
                  className={cn(
                    inputClass,
                    "w-32",
                    commissionType === "" && "cursor-not-allowed opacity-50"
                  )}
                />
              </Label>
            </div>
          </fieldset>

          <Label text='תנאי תשלום ברירת מחדל (למשל "שוטף+30", "מקדמה 50%")'>
            <input
              type="text"
              name="defaultPaymentTerms"
              maxLength={120}
              defaultValue={initial?.defaultPaymentTerms ?? ""}
              className={inputClass}
            />
          </Label>

          <Label text="הערות פנימיות (לא לעיני הספק)">
            <textarea
              name="notes"
              rows={2}
              defaultValue={initial?.notes ?? ""}
              className={`${inputClass} resize-y`}
            />
          </Label>

          {/* Partners Marketplace (Block 30). Off by default — admin opts in
              explicitly. When on, this supplier shows up in /portal/partners
              and on the PM "הזמן ספק" dialog. The marketing copy + logo are
              kept separate from `services` / `notes` so the public view never
              accidentally leaks internal shorthand. */}
          <fieldset className="rounded border bg-muted/20 px-2 py-2">
            <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              חשיפה ב-Partners Marketplace
            </legend>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="isPublic"
                value="true"
                defaultChecked={!!initial?.isPublic}
                className="mt-1 size-3.5 cursor-pointer accent-primary"
              />
              <span className="text-[11px] leading-tight">
                פרסם את הספק בפורטל הלקוחות והפעל את כפתור &quot;בקש שירות&quot;.
                <span className="block text-[10px] text-muted-foreground">
                  כשמסומן, הספק מופיע ב-<code>/portal/partners</code> ובדיאלוג
                  &quot;הזמן ספק&quot; בעמוד ההיתר.
                </span>
              </span>
            </label>
            <div className="mt-2 space-y-2">
              <Label text="תיאור שיווקי (לעיני הלקוחות)">
                <textarea
                  name="marketingDescription"
                  rows={2}
                  maxLength={500}
                  placeholder="לדוגמה: מעבדה מורשית לבדיקות חשמל, מענה תוך 24 שעות, ניסיון של 15 שנים."
                  defaultValue={initial?.marketingDescription ?? ""}
                  className={`${inputClass} resize-y`}
                />
              </Label>
              <Label text="קישור ללוגו (URL מלא או נתיב Storage)">
                <input
                  type="text"
                  name="logoUrl"
                  maxLength={500}
                  placeholder="https://… או suppliers/<id>/logo.png"
                  defaultValue={initial?.logoUrl ?? ""}
                  className={inputClass}
                />
              </Label>
            </div>
          </fieldset>

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
            {mode === "edit" ? "שמור שינויים" : "שמור ספק"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function CommissionTypePill({
  label,
  value,
  active,
  onClick
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-value={value}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
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
