"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Briefcase, Loader2, User2, X } from "lucide-react";
import { submitClient } from "@/app/actions/clients";
import { cn } from "@/lib/utils";

// Block 38 — explicit "private vs business" segmentation. The Form-4
// home-entry upsell only fires for PRIVATE clients; business / contractor
// rows never receive the consumer-side promo copy.
export type ClientType = "PRIVATE" | "BUSINESS";

export type ClientFormInitial = {
  companyName: string;
  hp: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  clientType: ClientType;
};

type Mode =
  | { kind: "create" }
  | { kind: "update"; id: string; initial: ClientFormInitial };

const EMPTY: ClientFormInitial = {
  companyName: "",
  hp: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  clientType: "PRIVATE"
};

export function ClientFormDialog({
  mode,
  onClose
}: {
  mode: Mode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitClient, {
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

  const isEdit = mode.kind === "update";
  const initial = isEdit ? mode.initial : EMPTY;
  const [clientType, setClientType] = useState<ClientType>(initial.clientType);

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[560px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        {isEdit && <input type="hidden" name="id" value={mode.id} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {isEdit ? "עריכת לקוח" : "לקוח חדש"}
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

        <div className="grid grid-cols-2 gap-3 px-3 py-3">
          {/* Block 38 — explicit Private/Business classification. Required:
              gates the Form-4 home-entry upsell automation. Spans the full
              width so it can't be missed when the PM creates a client. */}
          <div className="col-span-2">
            <span className="mb-1 block text-[11px] font-medium">
              סוג לקוח <span className="ms-0.5 text-red-600">*</span>
            </span>
            <div
              role="radiogroup"
              aria-label="סוג לקוח"
              className="grid grid-cols-2 gap-2"
            >
              <ClientTypeOption
                active={clientType === "PRIVATE"}
                onClick={() => setClientType("PRIVATE")}
                icon={<User2 className="size-4" />}
                title="פרטי"
                description="לקוח קצה (בעל בית). מקבל הצעות שדרוג לאחר טופס 4."
              />
              <ClientTypeOption
                active={clientType === "BUSINESS"}
                onClick={() => setClientType("BUSINESS")}
                icon={<Briefcase className="size-4" />}
                title="עסקי / קבלן"
                description="קבלן או חברת בנייה. ללא תקשורת שיווקית לצרכן."
              />
            </div>
            <input type="hidden" name="clientType" value={clientType} />
          </div>
          <Field label="שם החברה" required>
            <input
              type="text"
              name="companyName"
              defaultValue={initial.companyName}
              required
              maxLength={120}
              placeholder='למשל: אחים כהן בנייה ופיתוח בע"מ'
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="ח.פ.">
            <input
              type="text"
              name="hp"
              defaultValue={initial.hp}
              maxLength={32}
              placeholder="514203187"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] font-mono tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="שם איש קשר" required>
            <input
              type="text"
              name="contactName"
              defaultValue={initial.contactName}
              required
              maxLength={120}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="טלפון איש קשר" required>
            <input
              type="tel"
              name="phone"
              defaultValue={initial.phone}
              required
              maxLength={32}
              placeholder="050-1234567"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="אימייל">
            <input
              type="email"
              name="email"
              defaultValue={initial.email}
              maxLength={120}
              placeholder="contact@example.com"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="כתובת">
            <input
              type="text"
              name="address"
              defaultValue={initial.address}
              maxLength={200}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <div className="col-span-2">
            <Field label="הערות">
              <textarea
                name="notes"
                defaultValue={initial.notes}
                rows={2}
                className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>

          {state.error && (
            <div className="col-span-2 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
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
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שמור
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ClientTypeOption({
  active,
  onClick,
  icon,
  title,
  description
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 rounded-md border px-2.5 py-2 text-start text-[12px] transition-all",
        active
          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
          : "border-input bg-background hover:bg-accent"
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex items-center justify-center rounded p-1",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
      >
        {icon}
      </span>
      <span className="flex-1">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="block text-[10.5px] leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
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
      <span className="mb-0.5 block text-[11px] font-medium">
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
