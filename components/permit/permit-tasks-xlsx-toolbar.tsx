"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Upload
} from "lucide-react";
import {
  exportPermitTasksXlsx,
  importPermitTasksXlsx
} from "@/app/actions/xlsx";
import type { XlsxImportResult } from "@/lib/xlsx";
import { cn } from "@/lib/utils";

// Block 21: replaces the old CSV toolbar on the per-permit tasks tab.
// The .xlsx server action returns base64 bytes; we decode them client-side
// into a Blob with the Excel MIME type so the browser triggers a download.
export function PermitTasksXlsxToolbar({
  permitId,
  canImport
}: {
  permitId: string;
  canImport: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPending, startImport] = useTransition();
  const [exportPending, startExport] = useTransition();
  const [importResult, setImportResult] = useState<XlsxImportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = () => {
    setExportError(null);
    startExport(async () => {
      const res = await exportPermitTasksXlsx(permitId);
      if (!res.ok || !res.base64) {
        setExportError(res.error ?? "שגיאה בייצוא");
        return;
      }
      // atob → byte string → Uint8Array; faithful round-trip of the
      // workbook bytes returned by the server.
      const binary = atob(res.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
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
    fd.append("permitId", permitId);
    startImport(async () => {
      const result = await importPermitTasksXlsx(fd);
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
            disabled={importPending}
            className={btnClass}
            title='ייבוא משימות מקובץ אקסל בפורמט מקובצקי ("דרישות / פירוט / סטאטוס")'
          >
            {importPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Upload className="size-3" />
            )}
            ייבוא מאקסל
          </button>
        )}
        <button
          type="button"
          onClick={handleExport}
          disabled={exportPending}
          className={btnClass}
          title="ייצוא משימות לפורמט מקובצקי (טופס 4 / תעודת גמר)"
        >
          {exportPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          ייצוא לאקסל
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
  result: XlsxImportResult;
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
