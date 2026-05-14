"use client";

import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import { cn, formatDateTime } from "@/lib/utils";
import { deleteWikiEntry } from "@/app/actions/authority-wiki";
import { WikiEntryFormDialog } from "./wiki-entry-form-dialog";

export type WikiEntryRow = {
  id: string;
  title: string;
  category: string | null;
  contentMd: string;
  createdAt: string;
  updatedAt: string;
};

type Mode =
  | { kind: "create" }
  | {
      kind: "update";
      id: string;
      initial: { title: string; category: string; contentMd: string };
    };

export function AuthorityDetailClient({
  authorityId,
  entries
}: {
  authorityId: string;
  entries: WikiEntryRow[];
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = (entry: WikiEntryRow) => {
    if (!window.confirm(`למחוק את הרשומה "${entry.title}"?\nהפעולה לא ניתנת לביטול.`)) {
      return;
    }
    setDeletingId(entry.id);
    startTransition(async () => {
      try {
        await deleteWikiEntry(entry.id);
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
          רשומות ויקי ({entries.length})
        </h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          רשומה חדשה
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-muted-foreground">
          אין רשומות ויקי לרשות זו עדיין. הוסף את הראשונה.
        </div>
      ) : (
        <ul className="divide-y">
          {entries.map((entry) => {
            const isDeleting = deletingId === entry.id && pending;
            const isUpdated = entry.updatedAt !== entry.createdAt;
            return (
              <li key={entry.id} className="px-3 py-3">
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.category && (
                        <Badge variant="muted">{entry.category}</Badge>
                      )}
                      <h3 className="text-[14px] font-semibold">{entry.title}</h3>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      נוצר: {formatDateTime(entry.createdAt)}
                      {isUpdated && (
                        <> · עודכן: {formatDateTime(entry.updatedAt)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMode({
                          kind: "update",
                          id: entry.id,
                          initial: {
                            title: entry.title,
                            category: entry.category ?? "",
                            contentMd: entry.contentMd
                          }
                        })
                      }
                      className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent"
                    >
                      <Pencil className="size-2.5" /> ערוך
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      disabled={isDeleting}
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
                </header>
                <div className="rounded border border-border/60 bg-muted/20 px-3 py-2">
                  <Markdown content={entry.contentMd} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {mode && (
        <WikiEntryFormDialog
          key={mode.kind === "update" ? `edit-${mode.id}` : "create"}
          mode={
            mode.kind === "update"
              ? {
                  kind: "update",
                  id: mode.id,
                  authorityId,
                  initial: mode.initial
                }
              : { kind: "create", authorityId }
          }
          onClose={() => setMode(null)}
        />
      )}
    </div>
  );
}
