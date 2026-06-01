"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Download,
  Globe,
  Loader2,
  Mail,
  Phone,
  Search,
  Truck
} from "lucide-react";
import { exportSuppliersXlsx } from "@/app/actions/suppliers-xlsx";
import { cn, formatILS } from "@/lib/utils";

// Phase 3 of the suppliers overhaul. The previous overview was a server-
// rendered 4-column table with no quick-search and no export. This wraps
// the data in a client component so the input + filter live colocated with
// the table, and adds the columns the PM asked for (contact + phone +
// website) so she can call/scan suppliers without drilling in first.

export type SupplierOverviewRow = {
  id: string;
  name: string;
  type: string | null;
  services: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  openTaskCount: number;
  openAmount: number;
};

export function SuppliersOverviewTable({ rows }: { rows: SupplierOverviewRow[] }) {
  const [query, setQuery] = useState("");
  const [exportPending, startExport] = useTransition();
  const [exportError, setExportError] = useState<string | null>(null);

  // Case-insensitive substring match across the columns a PM would scan to
  // find "the electrician who works the מרכז". Empty query → everything.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.name,
        r.type,
        r.services,
        r.contactName,
        r.phone,
        r.email,
        r.website
      ]
        .filter((v): v is string => !!v && v.trim() !== "")
        .join(" \n ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, rows]);

  const handleExport = () => {
    setExportError(null);
    startExport(async () => {
      const r = await exportSuppliersXlsx();
      if (!r.ok || !r.base64) {
        setExportError(r.error ?? "שגיאה בייצוא");
        return;
      }
      // Decode base64 → bytes → blob (same pattern as Block 21's permit-tasks
      // xlsx toolbar; server actions can't return binary, so base64 is the
      // boundary).
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

  if (rows.length === 0) {
    return (
      <div className="rounded-md border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
        אין ספקים מוגדרים
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          סקירת ספקים ({filtered.length}
          {filtered.length !== rows.length ? ` מתוך ${rows.length}` : ""}) — לחץ על שורה לפתיחה
        </h2>
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center">
            <Search className="pointer-events-none absolute end-2 size-3.5 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש: שם / סוג / איש קשר / טלפון…"
              className="w-64 rounded border border-input bg-background px-2 py-1 pe-7 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={exportPending}
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            title="ייצוא לרשימה לאקסל"
          >
            {exportPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Download className="size-3" />
            )}
            ייצוא לאקסל
          </button>
        </div>
      </div>

      {exportError && (
        <div className="inline-flex items-center gap-1 border-b bg-red-500/5 px-3 py-1 text-[10px] text-red-700 dark:text-red-300">
          <AlertTriangle className="size-3 shrink-0" />
          {exportError}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>ספק</th>
            <th>סוג</th>
            <th>איש קשר</th>
            <th className="w-36">טלפון</th>
            <th className="w-10 text-center">אתר</th>
            <th className="w-28 text-center">משימות פתוחות</th>
            <th className="w-32">סכום פתוח</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                אין ספקים שתואמים לחיפוש &quot;{query}&quot;
              </td>
            </tr>
          )}
          {filtered.map((s) => (
            <tr key={s.id} className="hover:bg-muted/30">
              <td>
                <Link
                  href={`/suppliers?supplier=${s.id}`}
                  className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                >
                  <Truck className="size-3 text-muted-foreground" />
                  {s.name}
                </Link>
                {s.services && (
                  <div className="mt-0.5 line-clamp-1 max-w-[26ch] text-[10px] text-muted-foreground">
                    {s.services}
                  </div>
                )}
              </td>
              <td className="text-xs text-muted-foreground">{s.type ?? "—"}</td>
              <td className="text-xs">
                {s.contactName ? (
                  <span>{s.contactName}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
                {s.email && (
                  <a
                    href={`mailto:${s.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <Mail className="size-3" />
                    {s.email}
                  </a>
                )}
              </td>
              <td className="text-xs tabular-nums">
                {s.phone ? (
                  <a
                    href={`tel:${s.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <Phone className="size-3 text-muted-foreground" />
                    {s.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="text-center">
                {s.website ? (
                  <a
                    href={s.website.startsWith("http") ? s.website : `https://${s.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={s.website}
                    className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Globe className="size-3.5" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="text-center text-xs tabular-nums">
                {s.openTaskCount > 0 ? (
                  <span className="font-semibold">{s.openTaskCount}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td
                className={cn(
                  "text-xs tabular-nums",
                  s.openAmount > 0 && "font-semibold"
                )}
              >
                {s.openAmount > 0 ? formatILS(s.openAmount) : <span className="text-muted-foreground">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
