"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { deletePartnerCategory } from "@/app/actions/partner-categories";
import { PartnerCategoryFormDialog } from "./partner-category-form-dialog";

export type PartnerCategoryRow = {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  supplierCount: number;
};

type DialogMode =
  | { kind: "create" }
  | {
      kind: "update";
      id: string;
      initial: { name: string; description: string; displayOrder: number };
    }
  | null;

export function PartnerCategoriesPageClient({
  rows
}: {
  rows: PartnerCategoryRow[];
}) {
  const [mode, setMode] = useState<DialogMode>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = (row: PartnerCategoryRow) => {
    const msg =
      row.supplierCount === 0
        ? `למחוק את "${row.name}"?\nהפעולה לא ניתנת לביטול.`
        : `למחוק את "${row.name}"?\n\n${row.supplierCount} ספקים משויכים יישארו ללא קטגוריה (לא ימחקו). פעולה לא הפיכה.`;
    if (!window.confirm(msg)) return;
    setDeletingId(row.id);
    startTransition(async () => {
      const res = await deletePartnerCategory(row.id);
      if (!res.ok) window.alert(res.error);
      setDeletingId(null);
    });
  };

  return (
    <>
      <div className="rounded-md border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Tag className="size-3.5" />
            קטגוריות שותפים ({rows.length})
          </h2>
          <button
            type="button"
            onClick={() => setMode({ kind: "create" })}
            className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-3" />
            קטגוריה חדשה
          </button>
        </div>

        <div className="border-b bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          קטגוריות אלה מופיעות כפילטרים בעמוד <code>/partners</code> ובדרופ-דאון
          של טופס הספק. סדר תצוגה נמוך = קודם ברשימה.
        </div>

        {rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            עדיין אין קטגוריות. צור את הראשונה.
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="flex flex-col gap-2 p-2 md:hidden">
              {rows.map((row) => {
                const isDeleting = deletingId === row.id && pending;
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                        #{row.displayOrder}
                      </span>
                      <div className="text-sm font-medium">{row.name}</div>
                    </div>
                    {row.description && (
                      <div className="text-[11px] text-muted-foreground line-clamp-2">
                        {row.description}
                      </div>
                    )}
                    <div className="text-[11px] tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {row.supplierCount}
                      </span>{" "}
                      ספקים משויכים
                    </div>
                    <div className="mt-1 flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setMode({
                            kind: "update",
                            id: row.id,
                            initial: {
                              name: row.name,
                              description: row.description ?? "",
                              displayOrder: row.displayOrder
                            }
                          })
                        }
                        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
                      >
                        <Pencil className="size-3" />
                        ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/5 px-2 py-1 text-[11px] text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
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
              })}
            </div>

            {/* Desktop */}
            <table className="hidden w-full md:table">
              <thead>
                <tr>
                  <th className="w-16">סדר</th>
                  <th>שם</th>
                  <th>תיאור</th>
                  <th className="w-24 text-center">ספקים</th>
                  <th className="w-32 text-end">פעולות</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isDeleting = deletingId === row.id && pending;
                  return (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="tabular-nums text-muted-foreground">
                        {row.displayOrder}
                      </td>
                      <td className="text-[13px] font-medium">{row.name}</td>
                      <td className="text-[12px] text-muted-foreground">
                        {row.description ?? "—"}
                      </td>
                      <td className="text-center tabular-nums">
                        {row.supplierCount}
                      </td>
                      <td className="text-end">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setMode({
                                kind: "update",
                                id: row.id,
                                initial: {
                                  name: row.name,
                                  description: row.description ?? "",
                                  displayOrder: row.displayOrder
                                }
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
                          >
                            <Pencil className="size-3" />
                            ערוך
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            disabled={isDeleting}
                            className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/5 px-2 py-0.5 text-[11px] text-red-700 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
                          >
                            {isDeleting ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Trash2 className="size-3" />
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
          </>
        )}
      </div>

      {mode && (
        <PartnerCategoryFormDialog
          mode={mode.kind}
          initial={mode.kind === "update" ? mode.initial : undefined}
          categoryId={mode.kind === "update" ? mode.id : undefined}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}
