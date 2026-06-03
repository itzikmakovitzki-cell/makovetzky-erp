import Link from "next/link";
import { ArrowRight, CheckCircle2, Coins, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/global/page-header";
import { CommissionsPeriodFilter } from "@/components/finances/commissions-period-filter";
import { CommissionsExportButton } from "@/components/finances/commissions-export-button";
import {
  isValidPreset,
  resolveCommissionAmount,
  resolvePeriod
} from "@/lib/commissions";
import { cn, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Phase 4 — supplier-commissions ledger.
// Three numbers per supplier in the chosen window:
//   - Earned: assignments that crossed into COMPLETED inside the window.
//     The PM "earned" their commission the moment the work closed.
//   - Paid: commissionPaidAt inside the window. Independent of when the
//     work completed — settlement timing belongs to a different period.
//   - Outstanding: assignments COMPLETED on/before the window end with
//     commissionPaidAt still null. Cumulative (not scoped to the window
//     start) — the "you've still got X waiting" rollup.

export default async function SupplierCommissionsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const presetRaw = typeof params.period === "string" ? params.period : undefined;
  const preset = isValidPreset(presetRaw) ? presetRaw : "month";
  const fromRaw = typeof params.from === "string" ? params.from : undefined;
  const toRaw = typeof params.to === "string" ? params.to : undefined;
  const period = resolvePeriod(preset, fromRaw, toRaw);

  // Pull every assignment whose completedAt OR commissionPaidAt OR (status
  // = COMPLETED + commissionPaidAt null) intersects the period — i.e.
  // anything that could land in one of the three buckets. The supplier
  // + their defaults travel along so commission resolution stays local.
  const assignments = await prisma.supplierTaskAssignment.findMany({
    where: {
      task: { deletedAt: null, permit: { deletedAt: null } },
      OR: [
        {
          status: "COMPLETED",
          completedAt: { gte: period.from, lt: period.to }
        },
        { commissionPaidAt: { gte: period.from, lt: period.to } },
        // Outstanding leg — completed at any point up to the window end,
        // unpaid as of now. We filter the bucketing below so this doesn't
        // double-count earned/paid in-window.
        {
          status: "COMPLETED",
          commissionPaidAt: null,
          completedAt: { lt: period.to }
        }
      ]
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          type: true,
          defaultCommissionType: true,
          defaultCommissionValue: true
        }
      },
      task: {
        select: {
          id: true,
          name: true,
          permit: { select: { id: true, name: true } }
        }
      }
    },
    orderBy: [{ supplierId: "asc" }, { completedAt: "asc" }]
  });

  // Per-supplier aggregates.
  type Bucket = {
    supplierId: string;
    supplierName: string;
    supplierType: string | null;
    earnedAmount: number;
    earnedCount: number;
    paidAmount: number;
    paidCount: number;
    outstandingAmount: number;
    outstandingCount: number;
  };

  const bySupplier = new Map<string, Bucket>();
  let grandEarned = 0;
  let grandPaid = 0;
  let grandOutstanding = 0;

  for (const a of assignments) {
    const supplierDefault = {
      type: a.supplier.defaultCommissionType,
      value: a.supplier.defaultCommissionValue
        ? Number(a.supplier.defaultCommissionValue.toString())
        : null
    };
    const override = {
      type: a.commissionType,
      value: a.commissionValue ? Number(a.commissionValue.toString()) : null
    };
    const baseAmount = a.amount ? Number(a.amount.toString()) : null;
    const commission = resolveCommissionAmount({
      override,
      supplierDefault,
      baseAmount
    });
    if (commission === null) continue;

    const bucket = bySupplier.get(a.supplier.id) ?? {
      supplierId: a.supplier.id,
      supplierName: a.supplier.name,
      supplierType: a.supplier.type,
      earnedAmount: 0,
      earnedCount: 0,
      paidAmount: 0,
      paidCount: 0,
      outstandingAmount: 0,
      outstandingCount: 0
    };
    bySupplier.set(a.supplier.id, bucket);

    // EARNED in window — status COMPLETED + completedAt inside.
    if (
      a.status === "COMPLETED" &&
      a.completedAt &&
      a.completedAt >= period.from &&
      a.completedAt < period.to
    ) {
      bucket.earnedAmount += commission;
      bucket.earnedCount += 1;
      grandEarned += commission;
    }
    // PAID in window — commissionPaidAt inside.
    if (
      a.commissionPaidAt &&
      a.commissionPaidAt >= period.from &&
      a.commissionPaidAt < period.to
    ) {
      bucket.paidAmount += commission;
      bucket.paidCount += 1;
      grandPaid += commission;
    }
    // OUTSTANDING — completed by window end, not yet paid. Cumulative.
    if (
      a.status === "COMPLETED" &&
      a.commissionPaidAt === null &&
      a.completedAt &&
      a.completedAt < period.to
    ) {
      bucket.outstandingAmount += commission;
      bucket.outstandingCount += 1;
      grandOutstanding += commission;
    }
  }

  const buckets = [...bySupplier.values()].sort(
    (a, b) => b.outstandingAmount - a.outstandingAmount
  );

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Link
          href="/finances"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לכספים
        </Link>
      </div>

      <PageHeader
        title="עמלות מספקים"
        accent={period.label}
        description="מעקב אחר עמלות שמגיעות לי מהספקים. סינון תקופה נשמר ב-URL."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CommissionsPeriodFilter
          active={period.preset}
          fromDate={fromRaw ?? null}
          toDate={toRaw ?? null}
        />
        <CommissionsExportButton
          period={period.preset}
          from={fromRaw ?? null}
          to={toRaw ?? null}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <SummaryCard
          label="עמלות שהושלמו בתקופה"
          sum={grandEarned}
          tone="muted"
          icon={<Coins className="size-3.5 text-muted-foreground" />}
        />
        <SummaryCard
          label="שולם בתקופה"
          sum={grandPaid}
          tone="success"
          icon={<CheckCircle2 className="size-3.5 text-emerald-600" />}
        />
        <SummaryCard
          label="יתרה — מה שמגיע לי"
          sum={grandOutstanding}
          tone="warning"
          icon={<AlertCircle className="size-3.5 text-amber-600" />}
        />
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {buckets.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין עמלות בתקופה הזו
          </div>
        ) : (
          buckets.map((b) => (
            <Link
              key={b.supplierId}
              href={`/suppliers?supplier=${b.supplierId}&all=true`}
              className="block rounded-md border bg-card p-3 shadow-sm transition-colors active:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">
                    {b.supplierName}
                  </h3>
                  {b.supplierType && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {b.supplierType}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "text-end text-[13px] font-semibold tabular-nums",
                    b.outstandingAmount > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground"
                  )}
                >
                  {formatILS(b.outstandingAmount)}
                  <div className="text-[10px] font-normal text-muted-foreground">
                    יתרה
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">הושלם בתקופה</div>
                  <div className="tabular-nums">
                    {b.earnedAmount > 0
                      ? `${formatILS(b.earnedAmount)} (${b.earnedCount})`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">שולם בתקופה</div>
                  <div className="tabular-nums text-emerald-700 dark:text-emerald-300">
                    {b.paidAmount > 0
                      ? `${formatILS(b.paidAmount)} (${b.paidCount})`
                      : "—"}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
        {buckets.length > 0 && (
          <div className="rounded-md border bg-muted/30 p-3 text-[12px] font-semibold tabular-nums">
            <div className="flex items-center justify-between">
              <span>סה&quot;כ הושלם</span>
              <span>{formatILS(grandEarned)}</span>
            </div>
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
              <span>סה&quot;כ שולם</span>
              <span>{formatILS(grandPaid)}</span>
            </div>
            <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
              <span>סה&quot;כ יתרה</span>
              <span>{formatILS(grandOutstanding)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="hidden md:block rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            פירוט לפי ספק ({buckets.length})
          </h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>ספק</th>
              <th>סוג</th>
              <th className="w-32 text-end">הושלם בתקופה</th>
              <th className="w-32 text-end">שולם בתקופה</th>
              <th className="w-36 text-end">יתרה (מה שמגיע)</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  אין עמלות בתקופה הזו
                </td>
              </tr>
            )}
            {buckets.map((b) => (
              <tr key={b.supplierId} className="hover:bg-muted/30">
                <td>
                  <Link
                    href={`/suppliers?supplier=${b.supplierId}&all=true`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {b.supplierName}
                  </Link>
                </td>
                <td className="text-[11px] text-muted-foreground">
                  {b.supplierType ?? "—"}
                </td>
                <td className="text-end text-[12px] tabular-nums">
                  {b.earnedAmount > 0 ? (
                    <>
                      <span className="font-medium">{formatILS(b.earnedAmount)}</span>
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        ({b.earnedCount})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-end text-[12px] tabular-nums">
                  {b.paidAmount > 0 ? (
                    <>
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">
                        {formatILS(b.paidAmount)}
                      </span>
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        ({b.paidCount})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    "text-end text-[12px] tabular-nums",
                    b.outstandingAmount > 0 &&
                      "font-semibold text-amber-700 dark:text-amber-300"
                  )}
                >
                  {b.outstandingAmount > 0 ? (
                    <>
                      {formatILS(b.outstandingAmount)}
                      <span className="ms-1 text-[10px] font-normal text-muted-foreground">
                        ({b.outstandingCount})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-0 text-center">
                  <Link
                    href={`/suppliers?supplier=${b.supplierId}&all=true`}
                    className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-foreground"
                    aria-label="פתח ספק"
                  >
                    <ArrowRight className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          {buckets.length > 0 && (
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td colSpan={2} className="text-[11px]">
                  סה״כ
                </td>
                <td className="text-end text-[12px] tabular-nums">
                  {formatILS(grandEarned)}
                </td>
                <td className="text-end text-[12px] tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatILS(grandPaid)}
                </td>
                <td className="text-end text-[12px] tabular-nums text-amber-700 dark:text-amber-300">
                  {formatILS(grandOutstanding)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  sum,
  tone,
  icon
}: {
  label: string;
  sum: number;
  tone: "muted" | "warning" | "success";
  icon: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        tone === "warning" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5",
        tone === "success" &&
          "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className="mt-0.5 text-[16px] font-semibold tabular-nums">
        {formatILS(sum)}
      </div>
    </div>
  );
}
