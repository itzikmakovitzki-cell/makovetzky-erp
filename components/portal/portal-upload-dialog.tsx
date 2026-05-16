"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X, Upload } from "lucide-react";
import { portalUploadDocument } from "@/app/actions/portal";

export function PortalUploadDialog({
  permitId,
  taskId,
  taskName,
  onClose
}: {
  permitId: string;
  taskId: string | null;
  taskName: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(portalUploadDocument, {
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
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[480px] max-w-[calc(100vw-1.5rem)]"
    >
      <form action={formAction} encType="multipart/form-data">
        <input type="hidden" name="permitId" value={permitId} />
        {taskId && <input type="hidden" name="taskId" value={taskId} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <h2 className="inline-flex items-center gap-1.5 text-[14px] font-semibold">
            <Upload className="size-3.5" />
            העלאת מסמך
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
          {taskName && (
            <div className="rounded border bg-muted/30 px-2.5 py-1.5 text-[12px]">
              <div className="text-[10px] text-muted-foreground">משימה</div>
              <div className="font-medium">{taskName}</div>
            </div>
          )}

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-foreground">
              קובץ
              <span className="ms-0.5 text-red-600">*</span>
            </span>
            <input
              type="file"
              name="file"
              required
              className="block w-full text-[12px] file:me-2 file:rounded file:border file:border-input file:bg-background file:px-2 file:py-1 file:text-[12px] file:font-medium file:text-foreground hover:file:bg-accent"
            />
            <span className="mt-1 block text-[10px] text-muted-foreground">
              עד 25MB · PDF, תמונה, וכל סוג קובץ אחר
            </span>
          </label>

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-foreground">
              הערה (אופציונלי)
            </span>
            <textarea
              name="note"
              rows={2}
              placeholder='לדוגמה: "תשריט מעודכן לפי הערות הרשות"'
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
