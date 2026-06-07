"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type {
  SupplierAssignmentStatus,
  SupplierCommissionType
} from "@prisma/client";
import {
  createSupplierAssignment,
  updateSupplierAssignment,
  type AssignmentFormState
} from "@/app/actions/supplier-assignments";
import { cn } from "@/lib/utils";

export type AssignmentInitialValues = {
  id?: string;
  supplierId: string;
  taskId?: string;
  status?: SupplierAssignmentStatus | null;
  amount?: string | number | null;
  commissionType?: SupplierCommissionType | null;
  commissionValue?: string | number | null;
  paymentTerms?: string | null;
  dueDate?: string | Date | null;
  notes?: string | null;
};

export type TaskOption = {
  id: string;
  name: string;
  permitName: string;
  permitNumber: string | null;
};

const STATUS_OPTIONS: Array<{ value: SupplierAssignmentStatus; label: string }> = [
  { value: "OPEN", label: "פתוח" },
  { value: "IN_PROGRESS", label: "בעבודה" },
  { value: "COMPLETED", label: "הושלם" },
  { value: "CANCELLED", label: "בוטל" }
];

// Shared dialog for creating + editing a SupplierTaskAssignment. The task
// picker is locked in edit mode (you can't move an assignment to a different
// task without deleting + recreating — semantically cleaner). Commission
// fields are optional: leaving them null = inherit from the supplier.

export function AssignmentFormDialog({
  mode,
  supplierName,
  initial,
  taskOptions,
  supplierDefaults,
  onClose
}: {
  mode: "create" | "edit";
  supplierName: string;
  initial: AssignmentInitialValues;
  // Tasks available to attach. For "create" we pass every non-deleted task
  // across the system; for "edit" the list isn't used (task is locked).
  taskOptions: TaskOption[];
  // Shown next to the commission inputs so the user sees what "leave empty"
  // resolves to.
  supplierDefaults: {
    commissionType: SupplierCommissionType | null;
    commissionValue: string | null;
    paymentTerms: string | null;
  };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initialState: AssignmentFormState = { error: null, ok: false };
  const [state, formAction, isPending] = useActionState(
    mode === "edit" ? updateSupplierAssignment : createSupplierAssignment,
    initialState
  );

  const [commissionType, setCommissionType] = useState<SupplierCommissionType | "">(
    initial.commissionType ?? ""
  );

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

  const dueDateValue =
    initial.dueDate instanceof Date
      ? initial.dueDate.toISOString().slice(0, 10)
      : typeof initial.dueDate === "string"
        ? initial.dueDate.slice(0, 10)
        : "";

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[640px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction} dir="rtl">
        <input type="hidden" name="supplierId" value={initial.supplierId} />
        {mode === "edit" && initial.id && (
          <input type="hidden" name="assignmentId" value={initial.id} />
        )}
        {/* Edit mode locks the task — the hidden field still posts it so the
            server action's readAssignmentForm pulls it as taskId. */}
        {mode === "edit" && initial.taskId && (
          <input type="hidden" name="taskId" value={initial.taskId} />
        )}
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">
            {mode === "edit" ? "עריכת הקצאה" : `הקצאה חדשה — ${supplierName}`}
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
          {/* Task picker — locked in edit mode. */}
          {mode === "create" ? (
            <Label text="משימה" required>
              <select
                name="taskId"
                required
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled>
                  בחר משימה…
                </option>
                {taskOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.permitName} · {t.name}
                  </option>
                ))}
              </select>
              {taskOptions.length === 0 && (
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  אין משימות זמינות
                </span>
              )}
            </Label>
          ) : (
            <div className="rounded border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
              המשימה לא ניתנת לעריכה לאחר היצירה. אם הקצית למשימה הלא נכונה, מחק
              את ההקצאה וצור חדשה.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Label text="סטטוס">
              <select
                name="status"
                defaultValue={initial.status ?? "OPEN"}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Label>
            <Label text="תאריך יעד">
              <input
                type="date"
                name="dueDate"
                defaultValue={dueDateValue}
                className={inputClass}
              />
            </Label>
          </div>

          {/* Commission — per-assignment override of supplier defaults. */}
          <fieldset className="rounded border bg-muted/20 px-2 py-2">
            <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              עמלה להקצאה זו
            </legend>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <div className="mb-0.5 text-[11px] font-medium">סוג</div>
                <div
                  role="radiogroup"
                  className="inline-flex items-center rounded-md border border-input bg-background p-0.5"
                >
                  <CommissionTypePill
                    label="ברירת מחדל"
                    value=""
                    active={commissionType === ""}
                    onClick={() => setCommissionType("")}
                  />
                  <CommissionTypePill
                    label="סכום ₪"
                    value="FIXED"
                    active={commissionType === "FIXED"}
                    onClick={() => setCommissionType("FIXED")}
                  />
                  <CommissionTypePill
                    label="אחוז %"
                    value="PERCENT"
                    active={commissionType === "PERCENT"}
                    onClick={() => setCommissionType("PERCENT")}
                  />
                </div>
                <input type="hidden" name="commissionType" value={commissionType} />
              </div>
              <Label
                text={
                  commissionType === "PERCENT"
                    ? "אחוז (0–100)"
                    : commissionType === "FIXED"
                      ? "סכום (₪)"
                      : "ערך"
                }
              >
                <input
                  type="number"
                  name="commissionValue"
                  min={0}
                  max={commissionType === "PERCENT" ? 100 : undefined}
                  step="0.01"
                  inputMode="decimal"
                  disabled={commissionType === ""}
                  defaultValue={
                    initial.commissionValue
                      ? String(initial.commissionValue)
                      : ""
                  }
                  className={cn(
                    inputClass,
                    "w-32",
                    commissionType === "" && "cursor-not-allowed opacity-50"
                  )}
                />
              </Label>
            </div>
            {commissionType === "" && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                ירש מהספק:{" "}
                {supplierDefaults.commissionType && supplierDefaults.commissionValue
                  ? supplierDefaults.commissionType === "FIXED"
                    ? `${supplierDefaults.commissionValue} ₪`
                    : `${supplierDefaults.commissionValue}%`
                  : "לא הוגדרה ברירת מחדל"}
              </div>
            )}
          </fieldset>

          <Label
            text={`תנאי תשלום${supplierDefaults.paymentTerms ? ` (ברירת מחדל מהספק: "${supplierDefaults.paymentTerms}")` : ""}`}
          >
            <input
              type="text"
              name="paymentTerms"
              maxLength={120}
              defaultValue={initial.paymentTerms ?? ""}
              className={inputClass}
              placeholder={supplierDefaults.paymentTerms ?? ""}
            />
          </Label>

          <Label text='סכום העסקה (אופציונלי — לחישוב % במידה ובחרת "אחוז")'>
            <input
              type="number"
              name="amount"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={initial.amount ? String(initial.amount) : ""}
              className={inputClass}
            />
          </Label>

          <Label text="הערות">
            <textarea
              name="notes"
              rows={2}
              defaultValue={initial.notes ?? ""}
              className={`${inputClass} resize-y`}
            />
          </Label>

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
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            {mode === "edit" ? "שמור שינויים" : "צור הקצאה"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function CommissionTypePill({
  label,
  value,
  active,
  onClick
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-value={value}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

const inputClass =
  "w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring";

function Label({
  text,
  required,
  children
}: {
  text: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium">
        {text} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}
