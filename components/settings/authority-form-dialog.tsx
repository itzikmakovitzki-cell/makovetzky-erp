"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { submitAuthority } from "@/app/actions/authorities";

type Mode =
  | { kind: "create" }
  | {
      kind: "update";
      id: string;
      initial: { name: string; region: string; contactInfo: string };
    };

export function AuthorityFormDialog({
  mode,
  onClose
}: {
  mode: Mode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitAuthority, {
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
    : { name: "", region: "", contactInfo: "" };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        {isEdit && <input type="hidden" name="id" value={mode.id} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {isEdit ? "עריכת רשות" : "רשות חדשה"}
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
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              שם הרשות <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              defaultValue={initial.name}
              required
              maxLength={120}
              placeholder="למשל: עיריית רחובות"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">מחוז / אזור</span>
            <input
              type="text"
              name="region"
              defaultValue={initial.region}
              maxLength={80}
              placeholder="למשל: מחוז המרכז"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">פרטי קשר</span>
            <textarea
              name="contactInfo"
              defaultValue={initial.contactInfo}
              rows={2}
              placeholder='למשל: מח׳ רישוי בנייה — טל׳ 08-9392222'
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>

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
