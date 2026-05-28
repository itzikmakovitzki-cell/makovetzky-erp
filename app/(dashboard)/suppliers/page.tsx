import Link from "next/link";
import { Truck, AlertCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SupplierPicker } from "@/components/global/supplier-picker";
import { PageHeader } from "@/components/global/page-header";
import {
  SUPPLIER_ASSIGNMENT_STATUS_LABEL,
  SUPPLIER_ASSIGNMENT_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SuppliersGlobalPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supplierId =
    typeof params.supplier === "string" && params.supplier ? params.supplier : null;
  const showAll = params.all === "true";

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" }
  });

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="ספקים"
        accent="Bulk View"
        description={'תצוגת "סבב ספק" — בחר ספק וראה את כל המשימות הפתוחות מולו חוצות-פרויקטים.'}
      />

      <SupplierPicker suppliers={suppliers} currentSupplierId={supplierId} />

      {supplierId ? (
        <SupplierDetail supplierId={supplierId} showAll={showAll} />
      ) : (
        <SuppliersOverview />
      )}
    </section>
  );
}

async function SuppliersOverview() {
  // Aggregate per supplier — used as a "pick me" overview when no supplier is selected.
  const suppliers = await prisma.supplier.findMany({
    include: {
      taskAssignments: {
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          task: { deletedAt: null, permit: { deletedAt: null } }
        },
        select: { id: true, amount: true }
      }
    },
    orderBy: { name: "asc" }
  });

  if (suppliers.length === 0) {
    return (
      <div className="rounded-md border bg-card px-3 py-6 text-center text-xs text-muted-foreground">
        אין ספקים מוגדרים
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <div className="border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          סקירת ספקים — לחץ על שורה לפתיחה
        </h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>ספק</th>
            <th>סוג</th>
            <th className="w-32 text-center">משימות פתוחות</th>
            <th className="w-32">סכום פתוח</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => {
            const openCount = s.taskAssignments.length;
            const openAmount = s.taskAssignments.reduce(
              (sum, a) => sum + (a.amount ? Number(a.amount.toString()) : 0),
              0
            );
            return (
              <tr key={s.id} className="hover:bg-muted/30">
                <td>
                  <Link
                    href={`/suppliers?supplier=${s.id}`}
                    className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                  >
                    <Truck className="size-3 text-muted-foreground" />
                    {s.name}
                  </Link>
                </td>
                <td className="text-xs text-muted-foreground">{s.type ?? "—"}</td>
                <td className="text-center text-xs tabular-nums">
                  {openCount > 0 ? (
                    <span className="font-semibold">{openCount}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-xs tabular-nums">
                  {openAmount > 0 ? (
                    <span className="font-semibold">{formatILS(openAmount)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

async function SupplierDetail({
  supplierId,
  showAll
}: {
  supplierId: string;
  showAll: boolean;
}) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      type: true,
      contactName: true,
      phone: true,
      email: true,
      defaultCommission: true
    }
  });

  if (!supplier) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-4 text-center text-xs text-red-700 dark:text-red-300">
        <AlertCircle className="me-1 inline size-3" /> הספק לא נמצא
      </div>
    );
  }

  const assignmentWhere: Prisma.SupplierTaskAssignmentWhereInput = {
    supplierId,
    // Hide assignments whose task is trashed — they're irrelevant for active
    // work. Restoring the task brings them back.
    task: { deletedAt: null, permit: { deletedAt: null } },
    ...(showAll ? {} : { status: { in: ["OPEN", "IN_PROGRESS"] } })
  };

  const assignments = await prisma.supplierTaskAssignment.findMany({
    where: assignmentWhere,
    include: {
      task: {
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          permit: { select: { id: true, name: true, permitNumber: true } }
        }
      }
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }]
  });

  const openAmount = assignments
    .filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")
    .reduce((s, a) => s + (a.amount ? Number(a.amount.toString()) : 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <SupplierCard label="ספק">
          <div className="text-sm font-semibold">{supplier.name}</div>
          {supplier.type && (
            <div className="text-[11px] text-muted-foreground">{supplier.type}</div>
          )}
        </SupplierCard>
        <SupplierCard label="איש קשר">
          <div className="text-sm font-medium">
            {supplier.contactName ?? <span className="text-muted-foreground">—</span>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {supplier.phone ?? "—"}
            {supplier.email && (
              <>
                {" · "}
                {supplier.email}
              </>
            )}
          </div>
        </SupplierCard>
        <SupplierCard label="סכום פתוח" accent={openAmount > 0 ? "warning" : undefined}>
          <div className="text-sm font-semibold tabular-nums">
            {formatILS(openAmount)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {assignments.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS").length}{" "}
            משימות פתוחות
          </div>
        </SupplierCard>
      </div>

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            משימות מול {supplier.name} ({assignments.length})
          </h2>
          {!showAll && (
            <span className="text-[10px] text-muted-foreground">
              מוצגות רק משימות פתוחות
            </span>
          )}
        </div>

        <table>
          <thead>
            <tr>
              <th>היתר</th>
              <th>משימה</th>
              <th className="w-32">סטטוס משימה</th>
              <th className="w-28">סכום</th>
              <th className="w-28">סטטוס שיוך</th>
              <th className="w-24">תאריך יעד</th>
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                  {showAll
                    ? "אין משימות לספק הזה"
                    : 'אין משימות פתוחות לספק הזה. סמן "הצג גם סגורות" לתצוגה מלאה.'}
                </td>
              </tr>
            )}
            {assignments.map((a) => {
              const isClosed = a.status === "COMPLETED" || a.status === "CANCELLED";
              return (
                <tr
                  key={a.id}
                  className={cn("hover:bg-muted/30", isClosed && "text-muted-foreground")}
                >
                  <td>
                    <Link
                      href={`/permits/${a.task.permit.id}/tasks`}
                      className="text-xs underline-offset-2 hover:underline"
                      title={a.task.permit.permitNumber ?? undefined}
                    >
                      {a.task.permit.name}
                    </Link>
                  </td>
                  <td>
                    <div className={cn("font-medium", isClosed && "line-through")}>
                      {a.task.name}
                    </div>
                    {a.notes && (
                      <div className="mt-0.5 text-[10px] italic text-muted-foreground">
                        {a.notes}
                      </div>
                    )}
                  </td>
                  <td>
                    <Badge variant={TASK_STATUS_VARIANT[a.task.status]}>
                      {TASK_STATUS_LABEL[a.task.status]}
                    </Badge>
                  </td>
                  <td className="text-xs tabular-nums">
                    {a.amount ? formatILS(Number(a.amount.toString())) : "—"}
                  </td>
                  <td>
                    <Badge variant={SUPPLIER_ASSIGNMENT_STATUS_VARIANT[a.status]}>
                      {SUPPLIER_ASSIGNMENT_STATUS_LABEL[a.status]}
                    </Badge>
                  </td>
                  <td className="text-xs tabular-nums">{formatDate(a.dueDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SupplierCard({
  label,
  children,
  accent
}: {
  label: string;
  children: React.ReactNode;
  accent?: "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2.5",
        accent === "warning" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5"
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
