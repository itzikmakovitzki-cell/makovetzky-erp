"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  XCircle
} from "lucide-react";
import type {
  SupplierAssignmentStatus,
  SupplierCommissionType
} from "@prisma/client";
import {
  AssignmentFormDialog,
  type AssignmentInitialValues,
  type TaskOption
} from "./assignment-form-dialog";
import {
  deleteSupplierAssignment,
  toggleAssignmentPaid
} from "@/app/actions/supplier-assignments";
import { cn } from "@/lib/utils";

// Shared trigger for the create flow on the supplier detail card.
export function AddAssignmentButton({
  supplierId,
  supplierName,
  taskOptions,
  supplierDefaults
}: {
  supplierId: string;
  supplierName: string;
  taskOptions: TaskOption[];
  supplierDefaults: {
    commissionType: SupplierCommissionType | null;
    commissionValue: string | null;
    paymentTerms: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
      >
        <Plus className="size-3" />
        הקצאה חדשה
      </button>
      {open && (
        <AssignmentFormDialog
          mode="create"
          supplierName={supplierName}
          initial={{ supplierId }}
          taskOptions={taskOptions}
          supplierDefaults={supplierDefaults}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Edit + delete + mark-paid live in a single row-actions component so the
// table column stays compact. Mark-paid toggles `commissionPaidAt` so phase 4
// can roll up paid vs outstanding without a separate ledger.
export function AssignmentRowActions({
  assignment,
  supplierName,
  supplierDefaults
}: {
  assignment: {
    id: string;
    supplierId: string;
    taskId: string;
    status: SupplierAssignmentStatus;
    amount: string | null;
    commissionType: SupplierCommissionType | null;
    commissionValue: string | null;
    paymentTerms: string | null;
    dueDate: string | null;
    notes: string | null;
    commissionPaidAt: string | null;
  };
  supplierName: string;
  supplierDefaults: {
    commissionType: SupplierCommissionType | null;
    commissionValue: string | null;
    paymentTerms: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pendingDelete, startDelete] = useTransition();
  const [pendingPaid, startPaid] = useTransition();

  const handleDelete = () => {
    if (!window.confirm("למחוק את ההקצאה הזו? פעולה לא הפיכה.")) return;
    startDelete(async () => {
      const r = await deleteSupplierAssignment(assignment.id);
      if (!r.ok) window.alert(r.error);
    });
  };

  const handleTogglePaid = () => {
    startPaid(async () => {
      const r = await toggleAssignmentPaid(assignment.id);
      if (!r.ok) window.alert(r.error);
    });
  };

  const isPaid = !!assignment.commissionPaidAt;

  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={handleTogglePaid}
        disabled={pendingPaid}
        title={isPaid ? "בטל סימון 'שולם'" : "סמן עמלה כשולמה"}
        className={cn(
          "inline-flex items-center justify-center rounded p-0.5 transition-colors disabled:cursor-not-allowed",
          isPaid
            ? "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {pendingPaid ? (
          <Loader2 className="size-3 animate-spin" />
        ) : isPaid ? (
          <CheckCircle2 className="size-3.5" />
        ) : (
          <XCircle className="size-3.5 opacity-50" />
        )}
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="ערוך הקצאה"
        className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pendingDelete}
        title="מחק הקצאה"
        className="inline-flex items-center justify-center rounded p-0.5 text-red-700/70 hover:bg-red-500/10 hover:text-red-700 dark:text-red-300/70 dark:hover:text-red-300"
      >
        {pendingDelete ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>
      {open && (
        <AssignmentFormDialog
          mode="edit"
          supplierName={supplierName}
          initial={
            {
              ...assignment
            } as AssignmentInitialValues
          }
          // taskOptions unused in edit mode but the prop is required by the dialog.
          taskOptions={[]}
          supplierDefaults={supplierDefaults}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
