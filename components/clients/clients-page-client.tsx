"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteClient } from "@/app/actions/clients";
import { exportClientsCsv, importClientsCsv } from "@/app/actions/csv";
import { CsvToolbar } from "@/components/global/csv-toolbar";
import { ClientFormDialog, type ClientFormInitial } from "./client-form-dialog";

export type ClientRow = {
  id: string;
  companyName: string;
  hp: string | null;
  contactName: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  dealCount: number;
  permitCount: number;
  activePermitCount: number;
};

type Mode =
  | { kind: "create" }
  | { kind: "update"; id: string; initial: ClientFormInitial };

export function ClientsPageClient({ rows }: { rows: ClientRow[] }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.companyName, r.hp, r.contactName, r.phone, r.email]
        .filter((v): v is string => Boolean(v))
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const handleDelete = (row: ClientRow) => {
    if (
      !window.confirm(
        `למחוק את "${row.companyName}"?\nהפעולה לא ניתנת לביטול.`
      )
    )
      return;
    setDeletingId(row.id);
    startTransition(async () => {
      try {
        await deleteClient(row.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">לקוחות ({rows.length})</h1>
          <p className="text-[11px] text-muted-foreground">
            כל הלקוחות העסקיים — חברות, עסקאות והיתרים שלהן.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CsvToolbar
            entityLabel="לקוחות"
            helpText="עמודות חובה: שם החברה, איש קשר, טלפון"
            exportAction={exportClientsCsv}
            importAction={importClientsCsv}
          />
          <button
            type="button"
            onClick={() => setMode({ kind: "create" })}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-3.5" />
            לקוח חדש
          </button>
        </div>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם חברה / ח.פ. / איש קשר / טלפון / אימייל…"
          className="w-full rounded border border-input bg-background px-2 py-1 pe-7 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="rounded-md border bg-card">
        <table>
          <thead>
            <tr>
              <th>שם החברה</th>
              <th className="w-28">ח.פ.</th>
              <th>איש קשר</th>
              <th className="w-32">טלפון</th>
              <th>אימייל</th>
              <th className="w-24 text-center">פרויקטים פעילים</th>
              <th className="w-20 text-center">סך עסקאות</th>
              <th className="w-32">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                  {rows.length === 0
                    ? "אין לקוחות עדיין. צור את הראשון."
                    : "אין תוצאות לחיפוש."}
                </td>
              </tr>
            )}
            {filtered.map((row) => {
              const isDeleting = deletingId === row.id && pending;
              const canDelete = row.dealCount === 0;
              return (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="font-medium">
                    <Link
                      href={`/clients/${row.id}`}
                      className="inline-flex items-center gap-1.5 underline-offset-2 hover:underline"
                    >
                      <Building2 className="size-3 text-muted-foreground" />
                      {row.companyName}
                    </Link>
                  </td>
                  <td className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {row.hp ?? "—"}
                  </td>
                  <td className="text-xs">{row.contactName}</td>
                  <td className="text-xs tabular-nums">{row.phone}</td>
                  <td className="text-[11px] text-muted-foreground">{row.email ?? "—"}</td>
                  <td className="text-center text-xs tabular-nums">
                    {row.activePermitCount > 0 ? (
                      <span className="font-semibold">{row.activePermitCount}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {row.permitCount > row.activePermitCount && (
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        / {row.permitCount}
                      </span>
                    )}
                  </td>
                  <td className="text-center text-xs tabular-nums">{row.dealCount}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMode({
                            kind: "update",
                            id: row.id,
                            initial: {
                              companyName: row.companyName,
                              hp: row.hp ?? "",
                              contactName: row.contactName,
                              phone: row.phone,
                              email: row.email ?? "",
                              address: row.address ?? "",
                              notes: row.notes ?? ""
                            }
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent"
                      >
                        <Pencil className="size-2.5" /> ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={!canDelete || isDeleting}
                        title={canDelete ? "מחק" : "לא ניתן למחוק — יש עסקאות פעילות"}
                        className={cn(
                          "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
                          (!canDelete || isDeleting) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {isDeleting ? (
                          <Loader2 className="size-2.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-2.5" />
                        )}
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mode && (
        <ClientFormDialog
          key={mode.kind === "update" ? `edit-${mode.id}` : "create"}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </section>
  );
}
