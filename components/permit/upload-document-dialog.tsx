"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload, X } from "lucide-react";
import { uploadDocument } from "@/app/actions/documents";
import { cn, formatFileSize } from "@/lib/utils";

export function UploadDocumentDialog({
  permitId,
  tasks,
  buildings,
  onClose
}: {
  permitId: string;
  tasks: { id: string; name: string }[];
  buildings: { id: string; label: string }[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, formAction, isPending] = useActionState(uploadDocument, {
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
    if (state.ok) {
      dialogRef.current?.close();
    }
  }, [state.ok]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mk-dialog w-[520px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="permitId" value={permitId} />

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">העלאת מסמך חדש</h2>
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
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded border border-dashed border-input bg-background px-3 py-2.5 text-[12px] hover:bg-accent/50",
                file && "border-solid border-foreground/30 bg-muted/20"
              )}
            >
              <Upload className="size-3.5 text-muted-foreground" />
              {file ? (
                <span className="flex flex-1 items-center gap-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">
                    {formatFileSize(file.size)}
                  </span>
                </span>
              ) : (
                <span className="text-muted-foreground">לחץ לבחירת קובץ…</span>
              )}
              <input
                type="file"
                name="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              נשמר ב-Supabase Storage (private bucket). הורדה דרך signed URL זמני.
              גודל מקסימלי: 25 MB.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="משימה משויכת (אופציונלי)">
              <select
                name="taskId"
                defaultValue=""
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— ללא שיוך —</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                שיוך למשימה מפעיל versioning אוטומטי.
              </p>
            </Field>
            <Field label="יחידה / בניין (אופציונלי)">
              <select
                name="buildingId"
                defaultValue=""
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— ללא שיוך —</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="הערות (אופציונלי)">
            <textarea
              name="notes"
              rows={2}
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
            disabled={isPending || !file}
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
