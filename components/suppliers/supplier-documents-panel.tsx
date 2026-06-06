"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition
} from "react";
import {
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
  UploadCloud,
  X
} from "lucide-react";
import {
  uploadSupplierDocument,
  deleteSupplierDocument,
  type SupplierDocumentFormState
} from "@/app/actions/supplier-documents";
import { cn, formatDate, formatFileSize } from "@/lib/utils";

// Block 38 — supplier documents panel.
//
// Displayed inside the supplier detail card. Lists previously-uploaded
// files (signed URL resolved server-side, expires every hour and is re-
// rendered on each page hit), with download + (ADMIN) delete + upload
// affordances. The upload itself goes through the server action so the
// file streams via Next.js Server Actions rather than a separate API.

export type SupplierDocumentItem = {
  id: string;
  fileName: string;
  // null when storage is unreachable or the signed URL failed; we still
  // render the row but disable the link.
  previewUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  description: string | null;
  uploadedAt: string; // ISO
  uploaderName: string | null;
};

export function SupplierDocumentsPanel({
  supplierId,
  documents,
  canManage
}: {
  supplierId: string;
  documents: SupplierDocumentItem[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          מסמכי ספק{documents.length > 0 ? ` (${documents.length})` : ""}
        </h3>
        {canManage && <UploadButton supplierId={supplierId} />}
      </div>

      {documents.length === 0 ? (
        <div className="rounded border border-dashed bg-muted/20 px-2 py-3 text-center text-[11px] text-muted-foreground">
          עוד לא הועלו מסמכים לספק זה.
          {canManage && " לחץ \"העלה קובץ\" כדי להוסיף מפרט / חוזה / תעריפים."}
        </div>
      ) : (
        <ul className="space-y-1">
          {documents.map((d) => (
            <SupplierDocumentRow
              key={d.id}
              doc={d}
              canManage={canManage}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SupplierDocumentRow({
  doc,
  canManage
}: {
  doc: SupplierDocumentItem;
  canManage: boolean;
}) {
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    if (
      !window.confirm(
        `למחוק את "${doc.fileName}"?\n\nהקובץ יוסר מהאחסון לצמיתות. פעולה לא הפיכה.`
      )
    ) {
      return;
    }
    startDelete(async () => {
      const res = await deleteSupplierDocument(doc.id);
      if (!res.ok) window.alert(res.error);
    });
  }

  return (
    <li className="flex items-start gap-2 rounded border bg-card px-2 py-1.5">
      <FileText className="size-3.5 shrink-0 translate-y-[1px] text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {doc.previewUrl ? (
          <a
            href={doc.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1 text-[12px] font-medium underline-offset-2 hover:underline"
          >
            <span className="truncate">{doc.fileName}</span>
            <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
          </a>
        ) : (
          <span className="block truncate text-[12px] font-medium">{doc.fileName}</span>
        )}
        {doc.description && (
          <div className="text-[11px] text-muted-foreground">{doc.description}</div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {formatDate(doc.uploadedAt)}
          {doc.uploaderName && <span className="ms-1">· {doc.uploaderName}</span>}
          {doc.sizeBytes != null && (
            <span className="ms-1">· {formatFileSize(doc.sizeBytes)}</span>
          )}
          {doc.mimeType && <span className="ms-1">· {doc.mimeType}</span>}
        </div>
      </div>
      {canManage && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded p-0.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
          aria-label="מחק קובץ"
          title="מחק"
        >
          {isDeleting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
        </button>
      )}
    </li>
  );
}

function UploadButton({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2 py-0.5 text-[10.5px] font-medium text-background hover:opacity-90"
      >
        <Upload className="size-3" />
        העלה קובץ
      </button>
      {open && (
        <UploadDialog supplierId={supplierId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function UploadDialog({
  supplierId,
  onClose
}: {
  supplierId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const initialState: SupplierDocumentFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    uploadSupplierDocument,
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
      className="fixed top-1/2 -translate-y-1/2 mx-auto w-[480px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-auto rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <form action={formAction}>
        <input type="hidden" name="supplierId" value={supplierId} />

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <UploadCloud className="size-3.5" />
            העלאת מסמך ספק
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
              קובץ <span className="text-red-600">*</span>
            </span>
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
                  <span className="font-medium truncate">{file.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
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
              נשמר ב-Supabase Storage (private bucket). הורדה דרך signed URL זמני. מקסימום 25 MB.
            </p>
          </label>

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תיאור (אופציונלי)</span>
            <input
              type="text"
              name="description"
              maxLength={120}
              placeholder='למשל: "מפרט שירותים", "חוזה התקשרות"'
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
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
            disabled={isPending || !file}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            העלה
          </button>
        </div>
      </form>
    </dialog>
  );
}
