"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import { submitWikiEntry } from "@/app/actions/authority-wiki";

type Mode =
  | { kind: "create"; authorityId: string }
  | {
      kind: "update";
      id: string;
      authorityId: string;
      initial: { title: string; category: string; contentMd: string };
    };

export function WikiEntryFormDialog({
  mode,
  onClose
}: {
  mode: Mode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitWikiEntry, {
    error: null,
    ok: false
  });

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  const isEdit = mode.kind === "update";
  const initial = isEdit
    ? mode.initial
    : { title: "", category: "", contentMd: "" };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[640px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        <input type="hidden" name="authorityId" value={mode.authorityId} />
        {isEdit && <input type="hidden" name="id" value={mode.id} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {isEdit ? "עריכת רשומת ויקי" : "רשומת ויקי חדשה"}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className="grid grid-cols-[1fr_180px] gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">
                כותרת <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                name="title"
                defaultValue={initial.title}
                required
                maxLength={200}
                placeholder="למשל: דרישות טופס 4 / איש קשר במחלקת מים"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">קטגוריה</span>
              <input
                type="text"
                name="category"
                defaultValue={initial.category}
                maxLength={50}
                placeholder="תכנון / כספים / קשרים"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              תוכן (Markdown) <span className="text-red-600">*</span>
            </span>
            <textarea
              name="contentMd"
              defaultValue={initial.contentMd}
              required
              rows={12}
              maxLength={20000}
              placeholder={"## כותרת\n- פריט ראשון\n- פריט שני **מודגש**\n\nפסקת המשך עם *הדגשה* קלה."}
              className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              תומך ב-Markdown בסיסי:{" "}
              <code className="font-mono">## כותרת</code> ·{" "}
              <code className="font-mono">- רשימה</code> ·{" "}
              <code className="font-mono">**מודגש**</code> ·{" "}
              <code className="font-mono">*נטוי*</code>
            </p>
          </label>

          {state.error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
              {state.error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isPending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שמור
          </button>
        </div>
      </form>
    </dialog>
  );
}
