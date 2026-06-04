"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import {
  createPartnerCategory,
  updatePartnerCategory,
  type CategoryFormState
} from "@/app/actions/partner-categories";

export function PartnerCategoryFormDialog({
  mode,
  categoryId,
  initial,
  onClose
}: {
  mode: "create" | "update";
  categoryId?: string;
  initial?: { name: string; description: string; displayOrder: number };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialState: CategoryFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    mode === "update" ? updatePartnerCategory : createPartnerCategory,
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

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="w-[480px] max-w-[calc(100vw-2rem)] rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <form action={formAction} dir="rtl">
        {mode === "update" && categoryId && (
          <input type="hidden" name="categoryId" value={categoryId} />
        )}
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {mode === "update"
              ? `עריכת קטגוריה — ${initial?.name ?? ""}`
              : "קטגוריה חדשה"}
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
              שם הקטגוריה <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              defaultValue={initial?.name ?? ""}
              autoFocus={mode === "create"}
              className={inputClass}
              placeholder='לדוגמה: "בעלי מקצוע"'
            />
          </label>

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              תיאור (אופציונלי — מוצג כפילטר tooltip)
            </span>
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={initial?.description ?? ""}
              className={`${inputClass} resize-y`}
              placeholder='למשל: "חשמלאים, שרברבים, מודדים ויועצים."'
            />
          </label>

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              סדר תצוגה
            </span>
            <input
              type="number"
              name="displayOrder"
              defaultValue={initial?.displayOrder ?? 0}
              step={10}
              className={`${inputClass} w-32`}
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              נמוך = קודם. הגדל בקפיצות של 10 כדי שיהיה קל להוסיף קטגוריה
              באמצע מאוחר יותר.
            </span>
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
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            {mode === "update" ? "שמור שינויים" : "צור קטגוריה"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

const inputClass =
  "w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring";
