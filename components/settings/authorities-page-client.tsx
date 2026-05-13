"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteAuthority } from "@/app/actions/authorities";
import { AuthorityFormDialog } from "./authority-form-dialog";

export type AuthorityRow = {
  id: string;
  name: string;
  region: string | null;
  contactInfo: string | null;
  permitCount: number;
  templateCount: number;
  wikiCount: number;
};

export function AuthoritiesPageClient({ rows }: { rows: AuthorityRow[] }) {
  const [mode, setMode] = useState<
    | { kind: "create" }
    | {
        kind: "update";
        id: string;
        initial: { name: string; region: string; contactInfo: string };
      }
    | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = (row: AuthorityRow) => {
    if (!window.confirm(`למחוק את "${row.name}"?\nהפעולה לא ניתנת לביטול.`)) return;
    setDeletingId(row.id);
    startTransition(async () => {
      try {
        await deleteAuthority(row.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          רשויות ({rows.length})
        </h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          רשות חדשה
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th>מחוז</th>
            <th>פרטי קשר</th>
            <th className="w-20 text-center">היתרים</th>
            <th className="w-20 text-center">תבניות</th>
            <th className="w-20 text-center">Wiki</th>
            <th className="w-32">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                אין רשויות. צור את הראשונה.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const isDeleting = deletingId === row.id && pending;
            const canDelete = row.permitCount === 0 && row.templateCount === 0;
            return (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="font-medium">{row.name}</td>
                <td className="text-xs text-muted-foreground">{row.region ?? "—"}</td>
                <td className="text-[11px] text-muted-foreground line-clamp-1" title={row.contactInfo ?? undefined}>
                  {row.contactInfo ?? "—"}
                </td>
                <td className="text-center text-xs tabular-nums">{row.permitCount}</td>
                <td className="text-center text-xs tabular-nums">{row.templateCount}</td>
                <td className="text-center text-xs tabular-nums">{row.wikiCount}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMode({
                          kind: "update",
                          id: row.id,
                          initial: {
                            name: row.name,
                            region: row.region ?? "",
                            contactInfo: row.contactInfo ?? ""
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
                      title={
                        canDelete ? "מחק" : "לא ניתן למחוק — יש היתרים או תבניות"
                      }
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

      {mode && (
        <AuthorityFormDialog
          key={mode.kind === "update" ? `edit-${mode.id}` : "create"}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
