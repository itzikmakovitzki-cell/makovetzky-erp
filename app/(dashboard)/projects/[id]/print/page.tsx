import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PrintTrigger } from "@/components/projects/print-trigger";
import {
  MASTER_DEAL_STATUS_LABEL,
  MASTER_DEAL_STATUS_VARIANT,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// PR-B of the polish sweep — printable project summary. Lives under the
// (dashboard) layout so auth + role checks still apply, then uses the
// body[data-printing] CSS rules in globals.css (set by <PrintTrigger>) to
// strip the dashboard chrome at print time. Browser print dialog → save
// as PDF for sending to a client.

const TASK_STATUS_ORDER: TaskStatus[] = [
  "AWAITING_AUTHORITY",
  "IN_PROGRESS",
  "OPEN",
  "BLOCKED",
  "COMPLETED"
];

export default async function ProjectPrintPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const deal = await prisma.masterDeal.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          phone: true,
          email: true,
          address: true
        }
      },
      permits: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          authority: { select: { name: true } },
          tasks: {
            where: { deletedAt: null },
            orderBy: [{ category: "asc" }, { dueDate: "asc" }],
            select: {
              id: true,
              name: true,
              category: true,
              status: true,
              dueDate: true,
              assignee: { select: { name: true } }
            }
          },
          milestones: isAdmin
            ? {
                orderBy: { createdAt: "asc" },
                select: {
                  id: true,
                  name: true,
                  amount: true,
                  status: true,
                  dueDate: true,
                  paidAt: true
                }
              }
            : false
        }
      }
    }
  });
  if (!deal) notFound();

  // Aggregate commissions for any supplier-assignment under this project's
  // tasks — admin-only since it's money.
  const supplierAssignments = isAdmin
    ? await prisma.supplierTaskAssignment.findMany({
        where: {
          task: {
            deletedAt: null,
            permit: { deletedAt: null, masterDealId: id }
          }
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              defaultCommissionType: true,
              defaultCommissionValue: true
            }
          },
          task: { select: { id: true, name: true, permit: { select: { name: true } } } }
        },
        orderBy: { createdAt: "asc" }
      })
    : [];

  // Roll up tasks per permit by status for the headline numbers.
  let projectTotalTasks = 0;
  let projectCompletedTasks = 0;
  for (const p of deal.permits) {
    projectTotalTasks += p.tasks.length;
    for (const t of p.tasks) if (t.status === "COMPLETED") projectCompletedTasks++;
  }
  const projectPct =
    projectTotalTasks === 0
      ? 0
      : Math.round((projectCompletedTasks / projectTotalTasks) * 100);

  const generatedAt = new Date();

  return (
    <div className="flex flex-col gap-4 print:gap-3">
      {/* Toolbar — print-hidden. */}
      <div
        className="flex items-center justify-between gap-2"
        data-print-hide="true"
      >
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לפרויקט
        </Link>
        <PrintTrigger />
      </div>

      {/* Document body */}
      <article className="space-y-4">
        <header className="border-b pb-3">
          <h1 className="text-xl font-bold">{deal.name}</h1>
          <div className="mt-1 text-[12px] text-muted-foreground">
            סיכום פרויקט · נוצר ב-{formatDate(generatedAt)}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
            <DT>לקוח</DT>
            <DD>
              {deal.client.companyName}
              {deal.client.contactName && (
                <span className="text-muted-foreground">
                  {" "}
                  · {deal.client.contactName}
                </span>
              )}
            </DD>
            {deal.client.phone && (
              <>
                <DT>טלפון</DT>
                <DD className="tabular-nums">{deal.client.phone}</DD>
              </>
            )}
            {deal.client.email && (
              <>
                <DT>אימייל</DT>
                <DD>{deal.client.email}</DD>
              </>
            )}
            {deal.client.address && (
              <>
                <DT>כתובת</DT>
                <DD>{deal.client.address}</DD>
              </>
            )}
            <DT>סטטוס פרויקט</DT>
            <DD>
              <Badge variant={MASTER_DEAL_STATUS_VARIANT[deal.status]}>
                {MASTER_DEAL_STATUS_LABEL[deal.status]}
              </Badge>
            </DD>
            {deal.contractDate && (
              <>
                <DT>תאריך חוזה</DT>
                <DD className="tabular-nums">{formatDate(deal.contractDate)}</DD>
              </>
            )}
            <DT>נוצר במערכת</DT>
            <DD className="tabular-nums">{formatDate(deal.createdAt)}</DD>
            <DT>היתרים</DT>
            <DD className="tabular-nums">
              {deal.permits.length} סה״כ
            </DD>
            <DT>התקדמות משימות</DT>
            <DD className="tabular-nums">
              {projectCompletedTasks}/{projectTotalTasks} ({projectPct}%)
            </DD>
          </dl>
        </header>

        {deal.notes && (
          <section>
            <h2 className="text-sm font-semibold">הערות פרויקט</h2>
            <p className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">
              {deal.notes}
            </p>
          </section>
        )}

        {deal.permits.length === 0 ? (
          <p className="text-[12px] italic text-muted-foreground">
            אין היתרים תחת הפרויקט הזה.
          </p>
        ) : (
          deal.permits.map((p) => {
            const total = p.tasks.length;
            const completed = p.tasks.filter((t) => t.status === "COMPLETED").length;
            const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

            // Group tasks by category for printable layout.
            const byCategory = new Map<string, typeof p.tasks>();
            for (const t of p.tasks) {
              const key = t.category ?? "(ללא סיווג)";
              const list = byCategory.get(key) ?? [];
              list.push(t);
              byCategory.set(key, list);
            }

            return (
              <section key={p.id} className="break-inside-avoid">
                <header className="flex items-baseline justify-between gap-2 border-b pb-1">
                  <h2 className="text-base font-semibold">
                    {p.name}
                    {p.permitNumber && (
                      <span className="ms-2 font-mono text-[11px] font-normal text-muted-foreground">
                        #{p.permitNumber}
                      </span>
                    )}
                  </h2>
                  <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                    {PERMIT_STATUS_LABEL[p.status]}
                  </Badge>
                </header>
                <dl className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span>
                    רשות:{" "}
                    <span className="font-medium text-foreground">{p.authority.name}</span>
                  </span>
                  <span>
                    משימות:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {completed}/{total} ({pct}%)
                    </span>
                  </span>
                  {p.expectedCloseDate && (
                    <span>
                      צפוי לסיום:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatDate(p.expectedCloseDate)}
                      </span>
                    </span>
                  )}
                </dl>

                {total > 0 && (
                  <table className="mt-2">
                    <thead>
                      <tr>
                        <th>משימה</th>
                        <th className="w-32">סטטוס</th>
                        <th className="w-28">אחראי</th>
                        <th className="w-24">תאריך יעד</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...byCategory.entries()]
                        .sort((a, b) => a[0].localeCompare(b[0], "he"))
                        .map(([category, items]) => (
                          <CategoryTasksRows
                            key={category}
                            category={category}
                            items={items.sort(
                              (a, b) =>
                                TASK_STATUS_ORDER.indexOf(a.status) -
                                TASK_STATUS_ORDER.indexOf(b.status)
                            )}
                          />
                        ))}
                    </tbody>
                  </table>
                )}

                {isAdmin && p.milestones && p.milestones.length > 0 && (
                  <div className="mt-3 break-inside-avoid">
                    <h3 className="text-[12px] font-semibold">אבני דרך לחיוב</h3>
                    <table className="mt-1">
                      <thead>
                        <tr>
                          <th>אבן דרך</th>
                          <th className="w-24 text-end">סכום</th>
                          <th className="w-24">סטטוס</th>
                          <th className="w-24">יעד</th>
                          <th className="w-24">שולם</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.milestones.map((m) => (
                          <tr key={m.id}>
                            <td>{m.name}</td>
                            <td className="text-end tabular-nums">
                              {formatILS(Number(m.amount.toString()))}
                            </td>
                            <td className="text-[11px]">{m.status}</td>
                            <td className="text-[11px] tabular-nums text-muted-foreground">
                              {m.dueDate ? formatDate(m.dueDate) : "—"}
                            </td>
                            <td className="text-[11px] tabular-nums text-muted-foreground">
                              {m.paidAt ? formatDate(m.paidAt) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )}

        {isAdmin && supplierAssignments.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className="text-sm font-semibold border-b pb-1">
              עמלות ספקים — תחת הפרויקט
            </h2>
            <table className="mt-2">
              <thead>
                <tr>
                  <th>ספק</th>
                  <th>משימה</th>
                  <th>היתר</th>
                  <th className="w-24 text-end">עמלה</th>
                  <th className="w-20">שולם?</th>
                </tr>
              </thead>
              <tbody>
                {supplierAssignments.map((a) => {
                  const type = a.commissionType ?? a.supplier.defaultCommissionType;
                  const value = a.commissionValue ?? a.supplier.defaultCommissionValue;
                  const label = value
                    ? type === "FIXED"
                      ? formatILS(Number(value.toString()))
                      : `${value.toString()}%`
                    : "—";
                  return (
                    <tr key={a.id}>
                      <td>{a.supplier.name}</td>
                      <td className="text-[11px]">{a.task.name}</td>
                      <td className="text-[11px] text-muted-foreground">
                        {a.task.permit.name}
                      </td>
                      <td className="text-end text-[11px] tabular-nums">{label}</td>
                      <td className="text-[11px] tabular-nums text-muted-foreground">
                        {a.commissionPaidAt ? formatDate(a.commissionPaidAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-6 border-t pt-2 text-[10px] text-muted-foreground">
          הופק ב-{formatDate(generatedAt)} · מקובצקי ניהול פרוייקטים
        </footer>
      </article>
    </div>
  );
}

function CategoryTasksRows({
  category,
  items
}: {
  category: string;
  items: Array<{
    id: string;
    name: string;
    status: TaskStatus;
    dueDate: Date | null;
    assignee: { name: string } | null;
  }>;
}) {
  return (
    <>
      <tr>
        <td colSpan={4} className="bg-muted/40 px-3 py-1 text-[11px] font-semibold">
          {category}
        </td>
      </tr>
      {items.map((t) => (
        <tr key={t.id}>
          <td className={cn(t.status === "COMPLETED" && "line-through opacity-70")}>
            {t.name}
          </td>
          <td>
            <Badge variant={TASK_STATUS_VARIANT[t.status]}>
              {TASK_STATUS_LABEL[t.status]}
            </Badge>
          </td>
          <td className="text-[11px] text-muted-foreground">
            {t.assignee?.name ?? "—"}
          </td>
          <td className="text-[11px] tabular-nums text-muted-foreground">
            {t.dueDate ? formatDate(t.dueDate) : "—"}
          </td>
        </tr>
      ))}
    </>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
      {children}
    </dt>
  );
}

function DD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dd className={cn("font-medium", className)}>{children}</dd>;
}
