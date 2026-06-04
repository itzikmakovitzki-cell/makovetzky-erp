"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import {
  exportListXlsx,
  type XlsxExportKind
} from "@/app/actions/xlsx-exports";

// Drop-in "ייצוא לאקסל" button. Every list page hands a `kind` ('proposals',
// 'clients', etc.) — the server action does the rest. Mirrors the existing
// CommissionsExportButton's base64 → blob → click-link download pattern so
// users see the same affordance everywhere.
export function ExportListButton({
  kind,
  label = "ייצוא לאקסל"
}: {
  kind: XlsxExportKind;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    startTransition(async () => {
      const r = await exportListXlsx({ kind });
      if (!r.ok || !r.base64) {
        setError(r.error ?? "שגיאה בייצוא");
        return;
      }
      const binary = atob(r.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Download className="size-3" />
        )}
        {label}
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle className="size-3" />
          {error}
        </span>
      )}
    </div>
  );
}
