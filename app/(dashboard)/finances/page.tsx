import Link from "next/link";
import { AlertCircle, CheckCircle2, Coins } from "lucide-react";
import type { MilestoneStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { FinancesFilterBar } from "@/components/global/finances-filter-bar";
import { PageHeader } from "@/components/global/page-header";
import { MILESTONE_STATUS_LABEL, MILESTONE_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<MilestoneStatus>(["PENDING", "DUE", "PAID"]);

function parseStatuses(raw: string | undefined): MilestoneStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => VALID_STATUSES.has(s as MilestoneStatus)) as MilestoneStatus[];
}

export default async function FinancesGlobalPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const statuses = parseStatuses(statusParam);

  // Always exclude milestones whose parent permit is soft-deleted, matching
  // the rest of the global views.
  const baseWhere: Prisma.BillingMilestoneWhereInput = {
    permit: { deletedAt: null }
  };
  const filteredWhere: Prisma.BillingMilestoneWhereInput =
    statuses.length > 0 ? { ...baseWhere, status: { in: statuses } } : baseWhere;

  const [rows, totals] = await Promise.all([
    prisma.billingMilestone.findMany({
      where: filteredWhere,
      include: {
        permit: {
          select: {
            id: true,
            name: true,
            permitNumber: true,
            masterDeal: {
              select: { client: { select: { id: true, companyName: true } } }
            }
          }
        },
        triggerTask: { select: { id: true, name: true } }
      },
      orderBy: [
        { status: "asc" },
        { dueDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" }
      ]
    }),
    prisma.billingMilestone.groupBy({
      by: ["status"],
      where: baseWhere,
      _sum: { amount: true },
      _count: { _all: true }
    })
  ]);

  const totalByStatus = new Map<MilestoneStatus, { sum: number; count: number }>();
  for (const t of totals) {
    totalByStatus.set(t.status, {
      sum: Number(t._sum.amount ?? 0),
      count: t._count._all
    });
  }
  const pending = totalByStatus.get("PENDING") ?? { sum: 0, count: 0 };
  const due = totalByStatus.get("DUE") ?? { sum: 0, count: 0 };
  const paid = totalByStatus.get("PAID") ?? { sum: 0, count: 0 };

  const now = new Date();

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="כספים"
        accent="אבני דרך לחיוב"
        description="תצוגה חוצת-פרויקטים. סינון נשמר ב-URL — אפשר לסמן כסימנייה."
        action={
          <Link
            href="/finances/supplier-commissions"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
          >
            <Coins className="size-3.5" />
            עמלות מספקים
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="ממתין"
          sum={pending.sum}
          count={pending.count}
          accent="muted"
        />
        <SummaryCard
          label="מועד הגיע"
          sum={due.sum}
          count={due.count}
          accent="warning"
          icon={<AlertCircle className="size-3.5 text-amber-600" />}
        />
        <SummaryCard
          label="שולם"
          sum={paid.sum}
          count={paid.count}
          accent="success"
          icon={<CheckCircle2 className="size-3.5 text-emerald-600" />}
        />
      </div>

      <FinancesFilterBar />

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תוצאות ({rows.length})
          </h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>לקוח</th>
              <th>היתר</th>
              <th>אבן דרך</th>
              <th>משימה מפעילה</th>
              <th className="w-28 text-end">סכום</th>
              <th className="w-28">תאריך יעד</th>
              <th className="w-24">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  {statuses.length > 0
                    ? "אין אבני דרך תואמות לסינון"
                    : "אין אבני דרך במערכת"}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const overdue =
                r.status !== "PAID" &&
                r.dueDate !== null &&
                new Date(r.dueDate).getTime() < now.getTime();
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="text-[12px]">
                    {r.permit.masterDeal.client.companyName}
                  </td>
                  <td className="text-[12px]">
                    <Link
                      href={`/permits/${r.permit.id}/finances`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {r.permit.name}
                    </Link>
                    {r.permit.permitNumber && (
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        · {r.permit.permitNumber}
                      </span>
                    )}
                  </td>
                  <td className="text-[12px]">{r.name}</td>
                  <td className="text-[11px] text-muted-foreground">
                    {r.triggerTask
                      ? r.triggerTask.name
                      : r.triggerPercentage !== null
                        ? `יעד ${r.triggerPercentage}% מהמשימות`
                        : "—"}
                  </td>
                  <td className="text-end text-[12px] tabular-nums font-medium">
                    {formatILS(r.amount)}
                  </td>
                  <td
                    className={cn(
                      "text-[11px] tabular-nums",
                      overdue
                        ? "font-semibold text-red-600"
                        : "text-muted-foreground"
                    )}
                  >
                    {r.dueDate ? formatDate(r.dueDate) : "—"}
                  </td>
                  <td>
                    <Badge variant={MILESTONE_STATUS_VARIANT[r.status]}>
                      {MILESTONE_STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  sum,
  count,
  accent,
  icon
}: {
  label: string;
  sum: number;
  count: number;
  accent: "muted" | "warning" | "success";
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        accent === "warning" &&
          "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5",
        accent === "success" &&
          "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold tabular-nums">
        {formatILS(sum)}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {count} אבני דרך
      </div>
    </div>
  );
}
