"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Upload
} from "lucide-react";
import type { ExportResult, ImportResult } from "@/lib/csv";
import { cn } from "@/lib/utils";

// Two-button CSV toolbar. Renders compact secondary-style buttons; the
// result of the most recent import is shown inline below the buttons so
// the user can scan created/skipped/error counts without a modal.
export function CsvToolbar({
  entityLabel,
  helpText,
  exportAction,
  importAction,
  canImport = true,
  disabled = false
}: {
  entityLabel: string;
  helpText?: string;
  exportAction: () => Promise<ExportResult>;
  importAction: (formData: FormData) => Promise<ImportResult>;
  canImport?: boolean;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPending, startImport] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = () => {
    setExportError(null);
    startExport(async () => {
      const res = await exportAction();
      if (!res.ok || !res.csv) {
        setExportError(res.error ?? "שגיאה בייצוא");
        return;
      }
      // Blob writes the JS string as UTF-8 bytes. The CSV already starts
      // with the BOM character (U+FEFF), which encodes to the 3-byte
      // UTF-8 BOM that Excel needs.
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const handleFile = (file: File) => {
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    startImport(async () => {
      const result = await importAction(fd);
      setImportResult(result);
    });
  };

  const btnClass =
    "inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="inline-flex flex-col items-stretch gap-1">
      <div className="inline-flex items-center gap-1">
        {canImport && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || importPending}
            className={btnClass}
            title={
              helpText ? `ייבא ${entityLabel} מ-CSV · ${helpText}` : `ייבא ${entityLabel} מ-CSV`
            }
          >
            {importPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}
            ייבא CSV
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={disabled || exportPending}
          className={btnClass}
          title={`ייצא ${entityLabel} ל-CSV`}
        >
          {exportPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          ייצא CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset so the same filename can be picked again.
            e.target.value = "";
          }}
        />
      </div>
      {exportError && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle className="size-3" />
          {exportError}
        </span>
      )}
      {importResult && (
        <ImportSummary
          result={importResult}
          onDismiss={() => setImportResult(null)}
        />
      )}
    </div>
  );
}

function ImportSummary({
  result,
  onDismiss
}: {
  result: ImportResult;
  onDismiss: () => void;
}) {
  if (result.error) {
    return (
      <div className="inline-flex items-center gap-1 text-[10px] text-red-700">
        <AlertTriangle className="size-3 shrink-0" />
        <span>{result.error}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="ms-2 underline-offset-2 hover:underline"
        >
          סגור
        </button>
      </div>
    );
  }
  const { created, skipped, errors } = result;
  const tone =
    errors.length > 0
      ? "text-amber-700"
      : created > 0
        ? "text-emerald-700"
        : "text-muted-foreground";
  return (
    <div className="flex flex-col gap-0.5 text-[10px]">
      <span className={cn("inline-flex items-center gap-1", tone)}>
        {errors.length === 0 ? (
          <CheckCircle2 className="size-3 shrink-0" />
        ) : (
          <AlertTriangle className="size-3 shrink-0" />
        )}
        <span>
          נוצרו <strong className="tabular-nums">{created}</strong> · דולגו{" "}
          <strong className="tabular-nums">{skipped}</strong> · שגיאות{" "}
          <strong className="tabular-nums">{errors.length}</strong>
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="ms-2 underline-offset-2 hover:underline"
        >
          סגור
        </button>
      </span>
      {errors.length > 0 && (
        <details className="text-amber-700">
          <summary className="cursor-pointer">פירוט שגיאות</summary>
          <ul className="ms-3 mt-0.5 list-disc">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i}>
                שורה {e.row}: {e.message}
              </li>
            ))}
            {errors.length > 20 && (
              <li className="text-muted-foreground">
                …ועוד {errors.length - 20} שגיאות
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
