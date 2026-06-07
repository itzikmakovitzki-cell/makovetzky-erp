"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { submitUser } from "@/app/actions/users";

type Mode =
  | { kind: "create" }
  | {
      kind: "update";
      userId: string;
      initial: {
        name: string;
        email: string;
        role: UserRole;
        phone: string | null;
      };
    };

export function UserFormDialog({
  mode,
  onClose
}: {
  mode: Mode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitUser, {
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
  const initial = isEdit
    ? mode.initial
    : { name: "", email: "", role: "EMPLOYEE" as UserRole, phone: null as string | null };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[440px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        {isEdit && <input type="hidden" name="userId" value={mode.userId} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {isEdit ? "עריכת משתמש" : "משתמש חדש"}
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
          <Field label="שם מלא" required>
            <input
              type="text"
              name="name"
              defaultValue={initial.name}
              required
              maxLength={120}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="אימייל" required>
            <input
              type="email"
              name="email"
              defaultValue={initial.email}
              required
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label='טלפון (לתזכורות וואצפ — אופציונלי, פורמט "0501234567")'>
            <input
              type="tel"
              name="phone"
              defaultValue={initial.phone ?? ""}
              maxLength={40}
              placeholder="0501234567 / +972501234567"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="תפקיד" required>
            <select
              name="role"
              defaultValue={initial.role}
              required
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="ADMIN">מנהל (ADMIN)</option>
              <option value="EMPLOYEE">עובד (EMPLOYEE)</option>
              <option value="CONTRACTOR">קבלן (CONTRACTOR)</option>
            </select>
          </Field>
          <Field label={isEdit ? "סיסמה חדשה (השאר ריק כדי לא לשנות)" : "סיסמה (לפחות 6 תווים)"} required={!isEdit}>
            <input
              type="password"
              name="password"
              required={!isEdit}
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
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
