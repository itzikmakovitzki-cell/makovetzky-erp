"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteBuildingType } from "@/app/actions/building-types";
import { BuildingTypeFormDialog } from "./building-type-form-dialog";

export type BuildingTypeRow = {
  id: string;
  name: string;
  description: string | null;
  templateCount: number;
};

export function BuildingTypesPageClient({ rows }: { rows: BuildingTypeRow[] }) {
  const [mode, setMode] = useState<
    | { kind: "create" }
    | { kind: "update"; id: string; initial: { name: string; description: string } }
    | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = (row: BuildingTypeRow) => {
    if (!window.confirm(`למחוק את "${row.name}"?\nהפעולה לא ניתנת לביטול.`)) return;
    setDeletingId(row.id);
    startTransition(async () => {
      try {
        await deleteBuildingType(row.id);
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
          סוגי בניינים ({rows.length})
        </h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          סוג חדש
        </button>
      </div>

      <div className="md:hidden flex flex-col gap-2 p-2">
        {rows.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין סוגי בניינים. צור את הראשון.
          </div>
        ) : (
          rows.map((row) => {
            const isDeleting = deletingId === row.id && pending;
            const canDelete = row.templateCount === 0;
            return (
              <div
                key={row.id}
                className="flex flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm"
              >
                <div className="text-sm font-medium">{row.name}</div>
                {row.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-2">
                    {row.description}
                  </div>
                )}
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {row.templateCount}
                  </span>{" "}
                  תבניות משימות
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setMode({
                        kind: "update",
                        id: row.id,
                        initial: { name: row.name, description: row.description ?? "" }
                      })
                    }
                    className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-[11px] hover:bg-accent"
                  >
                    <Pencil className="size-3" /> ערוך
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={!canDelete || isDeleting}
                    title={canDelete ? "מחק" : "לא ניתן למחוק — קיימות תבניות"}
                    className={cn(
                      "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
                      (!canDelete || isDeleting) && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Trash2 className="size-3" />
                    )}
                    מחק
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <table className="hidden md:table">
        <thead>
          <tr>
            <th>שם</th>
            <th>תיאור</th>
            <th className="w-28 text-center">תבניות משימות</th>
            <th className="w-32">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                אין סוגי בניינים. צור את הראשון.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const isDeleting = deletingId === row.id && pending;
            const canDelete = row.templateCount === 0;
            return (
              <tr key={row.id} className="hover:bg-muted/30">
                <td className="font-medium">{row.name}</td>
                <td className="text-xs text-muted-foreground">
                  {row.description ?? "—"}
                </td>
                <td className="text-center text-xs tabular-nums">{row.templateCount}</td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMode({
                          kind: "update",
                          id: row.id,
                          initial: { name: row.name, description: row.description ?? "" }
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
                      title={canDelete ? "מחק" : "לא ניתן למחוק — קיימות תבניות"}
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
        <BuildingTypeFormDialog
          key={mode.kind === "update" ? `edit-${mode.id}` : "create"}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
