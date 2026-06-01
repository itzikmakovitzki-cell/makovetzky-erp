import Link from "next/link";
import { AlertCircle, Globe, Mail, Phone } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SupplierPicker } from "@/components/global/supplier-picker";
import { AddSupplierButton } from "@/components/suppliers/add-supplier-button";
import { EditSupplierButton } from "@/components/suppliers/edit-supplier-button";
import {
  AddAssignmentButton,
  AssignmentRowActions
} from "@/components/suppliers/assignment-buttons";
import type { TaskOption } from "@/components/suppliers/assignment-form-dialog";
import {
  SuppliersOverviewTable,
  type SupplierOverviewRow
} from "@/components/suppliers/suppliers-overview-table";
import { AssignmentMobileList } from "@/components/suppliers/assignment-mobile-list";
import { PageHeader } from "@/components/global/page-header";
import {
  SUPPLIER_ASSIGNMENT_STATUS_LABEL,
  SUPPLIER_ASSIGNMENT_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Pull distinct, non-empty supplier types — drives the datalist on the
// create/edit form so admins reuse existing tags rather than typing
// slight variants ("מודד" vs "מודדים").
async function fetchTypeSuggestions(): Promise<string[]> {
  const rows = await prisma.supplier.findMany({
    where: { type: { not: null } },
    distinct: ["type"],
    select: { type: true },
    orderBy: { type: "asc" }
  });
  return rows.map((r) => r.type).filter((t): t is string => !!t && t.trim() !== "");
}

export default async function SuppliersGlobalPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supplierId =
    typeof params.supplier === "string" && params.supplier ? params.supplier : null;
  const showAll = params.all === "true";

  const [session, suppliers, typeSuggestions] = await Promise.all([
    auth(),
    prisma.supplier.findMany({
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" }
    }),
    fetchTypeSuggestions()
  ]);
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="ספקים"
        accent="Bulk View"
        description={'תצוגת "סבב ספק" — בחר ספק וראה את כל המשימות הפתוחות מולו חוצות-פרויקטים.'}
        action={
          isAdmin ? <AddSupplierButton typeSuggestions={typeSuggestions} /> : undefined
        }
      />

      <SupplierPicker suppliers={suppliers} currentSupplierId={supplierId} />

      {supplierId ? (
        <SupplierDetail
          supplierId={supplierId}
          showAll={showAll}
          isAdmin={isAdmin}
          typeSuggestions={typeSuggestions}
        />
      ) : (
        <SuppliersOverview />
      )}
    </section>
  );
}

async function SuppliersOverview() {
  // Aggregate per supplier — fed to the client overview table which handles
  // the search + xlsx export. We compute openTaskCount + openAmount on the
  // server so the client component stays lightweight.
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

  const rows: SupplierOverviewRow[] = suppliers.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    services: s.services,
    contactName: s.contactName,
    phone: s.phone,
    email: s.email,
    website: s.website,
    openTaskCount: s.taskAssignments.length,
    openAmount: s.taskAssignments.reduce(
      (sum, a) => sum + (a.amount ? Number(a.amount.toString()) : 0),
      0
    )
  }));

  return <SuppliersOverviewTable rows={rows} />;
}

async function SupplierDetail({
  supplierId,
  showAll,
  isAdmin,
  typeSuggestions
}: {
  supplierId: string;
  showAll: boolean;
  isAdmin: boolean;
  typeSuggestions: string[];
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
      website: true,
      services: true,
      defaultCommissionType: true,
      defaultCommissionValue: true,
      defaultPaymentTerms: true,
      notes: true
    }
  });

  if (!supplier) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/5 px-3 py-4 text-center text-xs text-red-700 dark:text-red-300">
        <AlertCircle className="me-1 inline size-3" /> הספק לא נמצא
      </div>
    );
  }

  // Format the commission for the supplier card — kept on the page so the
  // shape stays close to the source (we'll reuse the same idea for per-
  // assignment commission cells in phase 2).
  const commissionText =
    supplier.defaultCommissionType === "FIXED" && supplier.defaultCommissionValue
      ? formatILS(Number(supplier.defaultCommissionValue.toString()))
      : supplier.defaultCommissionType === "PERCENT" && supplier.defaultCommissionValue
        ? `${supplier.defaultCommissionValue.toString()}%`
        : null;

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

  // Tasks that *don't* already have an assignment for this supplier — fed to
  // the create-assignment dialog so the admin can only attach to fresh tasks.
  const taskOptions: TaskOption[] = isAdmin
    ? await prisma.task
        .findMany({
          where: {
            deletedAt: null,
            permit: { deletedAt: null },
            supplierAssignments: { none: { supplierId } }
          },
          select: {
            id: true,
            name: true,
            permit: { select: { name: true, permitNumber: true } }
          },
          orderBy: [{ permit: { name: "asc" } }, { name: "asc" }]
        })
        .then((rows) =>
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            permitName: r.permit.name,
            permitNumber: r.permit.permitNumber
          }))
        )
    : [];

  const supplierDefaults = {
    commissionType: supplier.defaultCommissionType,
    commissionValue: supplier.defaultCommissionValue?.toString() ?? null,
    paymentTerms: supplier.defaultPaymentTerms
  };

  const openAmount = assignments
    .filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")
    .reduce((s, a) => s + (a.amount ? Number(a.amount.toString()) : 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SupplierCard
          label="ספק"
          headerSlot={
            isAdmin && (
              <EditSupplierButton
                supplier={{
                  id: supplier.id,
                  name: supplier.name,
                  type: supplier.type,
                  contactName: supplier.contactName,
                  phone: supplier.phone,
                  email: supplier.email,
                  website: supplier.website,
                  services: supplier.services,
                  defaultCommissionType: supplier.defaultCommissionType,
                  defaultCommissionValue:
                    supplier.defaultCommissionValue?.toString() ?? null,
                  defaultPaymentTerms: supplier.defaultPaymentTerms,
                  notes: supplier.notes
                }}
                typeSuggestions={typeSuggestions}
              />
            )
          }
        >
          <div className="text-sm font-semibold">{supplier.name}</div>
          {supplier.type && (
            <div className="text-[11px] text-muted-foreground">{supplier.type}</div>
          )}
          {supplier.services && (
            <div className="mt-1 whitespace-pre-wrap text-[11px] text-muted-foreground">
              {supplier.services}
            </div>
          )}
        </SupplierCard>
        <SupplierCard label="איש קשר">
          <div className="text-sm font-medium">
            {supplier.contactName ?? <span className="text-muted-foreground">—</span>}
          </div>
          <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            {supplier.phone && (
              <a
                href={`tel:${supplier.phone}`}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Phone className="size-3" />
                {supplier.phone}
              </a>
            )}
            {supplier.email && (
              <a
                href={`mailto:${supplier.email}`}
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Mail className="size-3" />
                {supplier.email}
              </a>
            )}
            {supplier.website && (
              <a
                href={
                  supplier.website.startsWith("http")
                    ? supplier.website
                    : `https://${supplier.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
              >
                <Globe className="size-3" />
                {supplier.website}
              </a>
            )}
          </div>
        </SupplierCard>
        <SupplierCard label="עמלת ברירת מחדל">
          <div className="text-sm font-semibold tabular-nums">
            {commissionText ?? <span className="text-muted-foreground">—</span>}
          </div>
          {supplier.defaultPaymentTerms && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              תנאי תשלום: {supplier.defaultPaymentTerms}
            </div>
          )}
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
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              משימות מול {supplier.name} ({assignments.length})
            </h2>
            {!showAll && (
              <span className="text-[10px] text-muted-foreground">
                מוצגות רק משימות פתוחות
              </span>
            )}
          </div>
          {isAdmin && (
            <AddAssignmentButton
              supplierId={supplier.id}
              supplierName={supplier.name}
              taskOptions={taskOptions}
              supplierDefaults={supplierDefaults}
            />
          )}
        </div>

        {/* Mobile: stacked cards. The 9-column desktop table below is hidden
            under the md breakpoint — same dual-render pattern as
            SuppliersOverviewTable. */}
        <div className="md:hidden">
          <AssignmentMobileList
            assignments={assignments.map((a) => ({
              id: a.id,
              supplierId: a.supplierId,
              taskId: a.taskId,
              status: a.status,
              amount: a.amount?.toString() ?? null,
              commissionType: a.commissionType,
              commissionValue: a.commissionValue?.toString() ?? null,
              paymentTerms: a.paymentTerms,
              dueDate: a.dueDate,
              notes: a.notes,
              commissionPaidAt: a.commissionPaidAt,
              task: a.task
            }))}
            supplierName={supplier.name}
            supplierDefaults={supplierDefaults}
            showAll={showAll}
            isAdmin={isAdmin}
          />
        </div>

        <table className="hidden md:table">
          <thead>
            <tr>
              <th>היתר</th>
              <th>משימה</th>
              <th className="w-28">סטטוס משימה</th>
              <th className="w-28">עמלה</th>
              <th className="w-28">תנאי תשלום</th>
              <th className="w-24">שולם?</th>
              <th className="w-28">סטטוס שיוך</th>
              <th className="w-24">תאריך יעד</th>
              {isAdmin && <th className="w-24"></th>}
            </tr>
          </thead>
          <tbody>
            {assignments.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="py-6 text-center text-xs text-muted-foreground">
                  {showAll
                    ? "אין משימות לספק הזה"
                    : 'אין משימות פתוחות לספק הזה. סמן "הצג גם סגורות" לתצוגה מלאה.'}
                </td>
              </tr>
            )}
            {assignments.map((a) => {
              const isClosed = a.status === "COMPLETED" || a.status === "CANCELLED";
              // Resolve commission: per-assignment override → supplier default → null.
              const resolvedCommissionType =
                a.commissionType ?? supplier.defaultCommissionType ?? null;
              const resolvedCommissionValue =
                a.commissionValue ?? supplier.defaultCommissionValue ?? null;
              const commissionLabel = resolvedCommissionValue
                ? resolvedCommissionType === "FIXED"
                  ? formatILS(Number(resolvedCommissionValue.toString()))
                  : `${resolvedCommissionValue.toString()}%`
                : "—";
              const isInheritedCommission = !a.commissionType && !!supplier.defaultCommissionType;
              const resolvedPaymentTerms =
                a.paymentTerms ?? supplier.defaultPaymentTerms ?? null;
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
                    {commissionLabel}
                    {isInheritedCommission && commissionLabel !== "—" && (
                      <span className="ms-1 text-[9px] text-muted-foreground">
                        (ברירת מחדל)
                      </span>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {resolvedPaymentTerms ?? "—"}
                  </td>
                  <td className="text-xs">
                    {a.commissionPaidAt ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                        ✓ {formatDate(a.commissionPaidAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={SUPPLIER_ASSIGNMENT_STATUS_VARIANT[a.status]}>
                      {SUPPLIER_ASSIGNMENT_STATUS_LABEL[a.status]}
                    </Badge>
                  </td>
                  <td className="text-xs tabular-nums">{formatDate(a.dueDate)}</td>
                  {isAdmin && (
                    <td className="p-1 text-center">
                      <AssignmentRowActions
                        assignment={{
                          id: a.id,
                          supplierId: a.supplierId,
                          taskId: a.taskId,
                          status: a.status,
                          amount: a.amount?.toString() ?? null,
                          commissionType: a.commissionType,
                          commissionValue: a.commissionValue?.toString() ?? null,
                          paymentTerms: a.paymentTerms,
                          dueDate: a.dueDate?.toISOString() ?? null,
                          notes: a.notes,
                          commissionPaidAt: a.commissionPaidAt?.toISOString() ?? null
                        }}
                        supplierName={supplier.name}
                        supplierDefaults={supplierDefaults}
                      />
                    </td>
                  )}
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
  accent,
  headerSlot
}: {
  label: string;
  children: React.ReactNode;
  accent?: "warning";
  // Optional control to render on the header row (e.g. "ערוך" on the supplier
  // card). React.ReactNode so falsy values render nothing.
  headerSlot?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2.5",
        accent === "warning" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        {headerSlot}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
