"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import type { TaskResponsibility } from "@prisma/client";
import { submitTaskTemplate } from "@/app/actions/task-templates";
import { TASK_RESPONSIBILITY_LABEL } from "@/lib/status-maps";

type Mode =
  | {
      kind: "create";
      authorityId: string;
      buildingTypeId: string;
    }
  | {
      kind: "update";
      id: string;
      authorityId: string;
      buildingTypeId: string;
      initial: {
        name: string;
        description: string;
        defaultDurationDays: string;
        orderIndex: string;
        category: string;
        responsibility: TaskResponsibility | "";
        tags: string;
        defaultAssigneeId: string;
      };
    };

const RESPONSIBILITY_OPTIONS: TaskResponsibility[] = [
  "INTERNAL",
  "CLIENT",
  "CONTRACTOR",
  "AUTHORITY"
];

type AssignableUser = { id: string; name: string };

export function TemplateFormDialog({
  mode,
  assignableUsers,
  onClose
}: {
  mode: Mode;
  assignableUsers: AssignableUser[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitTaskTemplate, {
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
    : {
        name: "",
        description: "",
        defaultDurationDays: "",
        orderIndex: "",
        category: "",
        responsibility: "" as TaskResponsibility | "",
        tags: "",
        defaultAssigneeId: ""
      };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        <input type="hidden" name="authorityId" value={mode.authorityId} />
        <input type="hidden" name="buildingTypeId" value={mode.buildingTypeId} />
        {isEdit && <input type="hidden" name="id" value={mode.id} />}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {isEdit ? "עריכת תבנית" : "תבנית חדשה"}
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
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              שם התבנית <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              name="name"
              defaultValue={initial.name}
              required
              maxLength={120}
              placeholder="למשל: בדיקת בטון"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תיאור</span>
            <textarea
              name="description"
              defaultValue={initial.description}
              rows={2}
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">משך ברירת מחדל (ימים)</span>
              <input
                type="number"
                name="defaultDurationDays"
                defaultValue={initial.defaultDurationDays}
                min={0}
                step={1}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">סדר תצוגה</span>
              <input
                type="number"
                name="orderIndex"
                defaultValue={initial.orderIndex}
                min={0}
                step={1}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">קטגוריה</span>
              <input
                type="text"
                name="category"
                defaultValue={initial.category}
                maxLength={80}
                placeholder='למשל: "שלד", "אישורי רשויות"'
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium">אחריות</span>
              <select
                name="responsibility"
                defaultValue={initial.responsibility}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— ללא —</option>
                {RESPONSIBILITY_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {TASK_RESPONSIBILITY_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">תגיות</span>
            <input
              type="text"
              name="tags"
              defaultValue={initial.tags}
              placeholder="הפרד תגיות בקו אנכי |"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">אחראי ברירת מחדל</span>
            <select
              name="defaultAssigneeId"
              defaultValue={initial.defaultAssigneeId}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— ללא —</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              כל משימה שתיווצר אוטומטית מהתבנית תשויך לאחראי זה. ניתן לשנות פר-משימה לאחר היצירה.
            </span>
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
