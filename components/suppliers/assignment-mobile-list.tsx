import Link from "next/link";
import type { SupplierAssignmentStatus, SupplierCommissionType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  AssignmentRowActions
} from "@/components/suppliers/assignment-buttons";
import {
  SUPPLIER_ASSIGNMENT_STATUS_LABEL,
  SUPPLIER_ASSIGNMENT_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

// Mobile-only stacked-cards renderer for the supplier's assignment list.
// Pure presentation — receives already-resolved supplier defaults so the
// commission/payment-terms inheritance rule is identical to the desktop
// table on /suppliers (PR-D of the polish sweep).

export type AssignmentForMobile = {
  id: string;
  supplierId: string;
  taskId: string;
  status: SupplierAssignmentStatus;
  amount: string | null;
  commissionType: SupplierCommissionType | null;
  commissionValue: string | null;
  paymentTerms: string | null;
  dueDate: Date | null;
  notes: string | null;
  commissionPaidAt: Date | null;
  task: {
    name: string;
    status: import("@prisma/client").TaskStatus;
    permit: { id: string; name: string; permitNumber: string | null };
  };
};

export function AssignmentMobileList({
  assignments,
  supplierName,
  supplierDefaults,
  showAll,
  isAdmin
}: {
  assignments: AssignmentForMobile[];
  supplierName: string;
  supplierDefaults: {
    commissionType: SupplierCommissionType | null;
    commissionValue: string | null;
    paymentTerms: string | null;
  };
  showAll: boolean;
  isAdmin: boolean;
}) {
  if (assignments.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted-foreground">
        {showAll
          ? "אין משימות לספק הזה"
          : 'אין משימות פתוחות לספק הזה. סמן "הצג גם סגורות" לתצוגה מלאה.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y">
      {assignments.map((a) => {
        const isClosed = a.status === "COMPLETED" || a.status === "CANCELLED";
        const resolvedCommissionType =
          a.commissionType ?? supplierDefaults.commissionType;
        const resolvedCommissionValue =
          a.commissionValue ?? supplierDefaults.commissionValue;
        const commissionLabel = resolvedCommissionValue
          ? resolvedCommissionType === "FIXED"
            ? formatILS(Number(resolvedCommissionValue.toString()))
            : `${resolvedCommissionValue.toString()}%`
          : null;
        const resolvedPaymentTerms =
          a.paymentTerms ?? supplierDefaults.paymentTerms;

        return (
          <div
            key={a.id}
            className={cn(
              "flex flex-col gap-1.5 px-3 py-2.5",
              isClosed && "text-muted-foreground"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className={cn("text-[13px] font-medium", isClosed && "line-through")}>
                  {a.task.name}
                </div>
                <Link
                  href={`/permits/${a.task.permit.id}/tasks`}
                  className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                >
                  {a.task.permit.name}
                </Link>
              </div>
              {isAdmin && (
                <AssignmentRowActions
                  assignment={{
                    id: a.id,
                    supplierId: a.supplierId,
                    taskId: a.taskId,
                    status: a.status,
                    amount: a.amount,
                    commissionType: a.commissionType,
                    commissionValue: a.commissionValue,
                    paymentTerms: a.paymentTerms,
                    dueDate: a.dueDate?.toISOString() ?? null,
                    notes: a.notes,
                    commissionPaidAt: a.commissionPaidAt?.toISOString() ?? null
                  }}
                  supplierName={supplierName}
                  supplierDefaults={supplierDefaults}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <Badge variant={TASK_STATUS_VARIANT[a.task.status]}>
                {TASK_STATUS_LABEL[a.task.status]}
              </Badge>
              <Badge variant={SUPPLIER_ASSIGNMENT_STATUS_VARIANT[a.status]}>
                {SUPPLIER_ASSIGNMENT_STATUS_LABEL[a.status]}
              </Badge>
              {a.dueDate && (
                <span className="text-muted-foreground tabular-nums">
                  יעד: {formatDate(a.dueDate)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
              {commissionLabel && (
                <span>
                  <span className="text-muted-foreground">עמלה: </span>
                  <span className="font-medium tabular-nums">{commissionLabel}</span>
                </span>
              )}
              {resolvedPaymentTerms && (
                <span className="text-muted-foreground">
                  תנאים: {resolvedPaymentTerms}
                </span>
              )}
              {a.commissionPaidAt && (
                <span className="text-emerald-700 dark:text-emerald-300">
                  ✓ שולם {formatDate(a.commissionPaidAt)}
                </span>
              )}
            </div>

            {a.notes && (
              <p className="text-[10px] italic text-muted-foreground">{a.notes}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
