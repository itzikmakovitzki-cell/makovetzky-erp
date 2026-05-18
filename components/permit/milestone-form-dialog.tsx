"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { submitMilestone } from "@/app/actions/milestones";
import { cn } from "@/lib/utils";

type FormMode =
  | { kind: "create"; permitId: string }
  | { kind: "update"; milestoneId: string; permitId: string };

export type DialogInitialValues = {
  name: string;
  amount: number | "";
  // "task" = legacy 1:1 trigger; "percentage" = fires when permit-task
  // completion crosses triggerPercentage. Exactly one is meaningful.
  triggerKind: "task" | "percentage";
  triggerTaskId: string;
  triggerPercentage: number | "";
  dueDate: string;
  notes: string;
};

export function MilestoneFormDialog({
  mode,
  initial,
  availableTasks,
  onClose
}: {
  mode: FormMode;
  initial: DialogInitialValues;
  availableTasks: { id: string; name: string }[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(submitMilestone, {
    error: null,
    ok: false
  });
  // Local state controls which trigger panel (task vs percentage) is visible.
  // The form posts triggerKind so the server knows which branch to validate.
  const [triggerKind, setTriggerKind] = useState<"task" | "percentage">(
    initial.triggerKind ?? "task"
  );

  // Open the dialog when mounted.
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Sync native close (ESC, browser back) with parent state.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  // Close on successful submission.
  useEffect(() => {
    if (state.ok) {
      dialogRef.current?.close();
    }
  }, [state.ok]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      dialogRef.current?.close();
    }
  };

  const title = mode.kind === "create" ? "אבן דרך חדשה" : "עריכת אבן דרך";

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[480px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="kind" value={mode.kind} />
        {mode.kind === "create" ? (
          <input type="hidden" name="permitId" value={mode.permitId} />
        ) : (
          <input type="hidden" name="milestoneId" value={mode.milestoneId} />
        )}

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">{title}</h2>
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
          <Field label="שם אבן הדרך" required>
            <input
              type="text"
              name="name"
              defaultValue={initial.name}
              required
              maxLength={200}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="סכום (₪)" required>
              <input
                type="number"
                name="amount"
                defaultValue={initial.amount}
                required
                min={0}
                step={0.01}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="תאריך יעד">
              <input
                type="date"
                name="dueDate"
                defaultValue={initial.dueDate}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>

          {/* Trigger kind picker — a segmented pill above the relevant input. */}
          <div>
            <span className="mb-0.5 block text-[11px] font-medium text-foreground">
              מנגנון הפעלה
              <span className="ms-0.5 text-red-600">*</span>
            </span>
            <input type="hidden" name="triggerKind" value={triggerKind} />
            <div
              className="inline-flex w-full items-center gap-0.5 rounded-md border border-input bg-muted/40 p-0.5"
              role="radiogroup"
              aria-label="מנגנון הפעלה"
            >
              <TriggerKindButton
                active={triggerKind === "task"}
                onClick={() => setTriggerKind("task")}
                label="לפי משימה"
              />
              <TriggerKindButton
                active={triggerKind === "percentage"}
                onClick={() => setTriggerKind("percentage")}
                label="לפי % השלמה"
              />
            </div>
          </div>

          {triggerKind === "task" ? (
            <Field label="משימה מפעילה" required>
              <select
                name="triggerTaskId"
                defaultValue={initial.triggerTaskId}
                required={triggerKind === "task"}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>
                  בחר משימה…
                </option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                השלמת המשימה תפעיל אוטומטית סטטוס "מועד הגיע".
              </p>
            </Field>
          ) : (
            <Field label="אחוז השלמה ליעד (1–100)" required>
              <input
                type="number"
                name="triggerPercentage"
                defaultValue={initial.triggerPercentage}
                required={triggerKind === "percentage"}
                min={1}
                max={100}
                step={1}
                placeholder="לדוגמה: 80"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                אבן הדרך תסומן "מועד הגיע" כשהיתר זה יגיע לאחוז השלמת המשימות.
              </p>
            </Field>
          )}

          <Field label="הערות (אופציונלי)">
            <textarea
              name="notes"
              defaultValue={initial.notes}
              rows={2}
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

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
            className={cn(
              "inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
            )}
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שמור
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function TriggerKindButton({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-2 py-1 text-[11px] font-medium transition-all duration-150",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
