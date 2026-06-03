"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Building2, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteClient } from "@/app/actions/clients";
import { exportClientsCsv, importClientsCsv } from "@/app/actions/csv";
import { CsvToolbar } from "@/components/global/csv-toolbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/global/page-header";
import { ClientFormDialog, type ClientFormInitial } from "./client-form-dialog";
import { ClientMobileCard } from "./client-mobile-card";

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
    const message =
      row.dealCount === 0
        ? `למחוק את "${row.companyName}"?\nהלקוח יעבור לסל המחזור.`
        : `למחוק את "${row.companyName}"?\n\nזה ימחק גם את ${row.dealCount} העסקאות שלו (וכל ההיתרים והמשימות תחתיהן).\nהכל יעבור לסל המחזור.`;
    if (!window.confirm(message)) return;
    setDeletingId(row.id);
    startTransition(async () => {
      try {
        const r = await deleteClient(row.id);
        if (!r.ok) window.alert(r.error);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="לקוחות"
        accent={`(${rows.length})`}
        description="כל הלקוחות העסקיים — חברות, עסקאות והיתרים שלהן."
        action={
          <>
            <CsvToolbar
              entityLabel="לקוחות"
              helpText="עמודות חובה: שם החברה, איש קשר, טלפון"
              exportAction={exportClientsCsv}
              importAction={importClientsCsv}
            />
            <Button
              type="button"
              variant="cta"
              className="h-9"
              onClick={() => setMode({ kind: "create" })}
            >
              <Plus className="size-3.5" />
              לקוח חדש
            </Button>
          </>
        }
      />

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

      <div className="md:hidden flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            {rows.length === 0
              ? "אין לקוחות עדיין. צור את הראשון."
              : "אין תוצאות לחיפוש."}
          </div>
        ) : (
          filtered.map((row) => (
            <ClientMobileCard
              key={row.id}
              row={row}
              isDeleting={deletingId === row.id && pending}
              onEdit={(id, initial) => setMode({ kind: "update", id, initial })}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      <div className="hidden md:block rounded-md border bg-card">
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
              // The action now cascades into active deals/permits; the gate
              // is gone, but the per-row confirm copy lists what's about to
              // be removed (see handleDelete above).
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
                        disabled={isDeleting}
                        title={
                          row.dealCount > 0
                            ? `מחק לקוח (יסיר גם את ${row.dealCount} העסקאות)`
                            : "מחק לקוח"
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
                          isDeleting && "cursor-not-allowed opacity-50"
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
