import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { MILESTONE_STATUS_LABEL, MILESTONE_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate, formatILS } from "@/lib/utils";
import { DealMilestoneStatusControl } from "./deal-milestone-status-control";

// Deal-level financial breakdown, rendered only inside the "ניהול פיננסי"
// drawer on the master-deal page. Aggregates billing milestones across every
// permit in the deal so admins get the full money picture in one private view.
export async function DealFinanceSummary({ dealId }: { dealId: string }) {
  const deal = await prisma.masterDeal.findUnique({
    where: { id: dealId },
    select: {
      totalValue: true,
      permits: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          milestones: {
            orderBy: [{ status: "asc" }, { dueDate: "asc" }],
            select: {
              id: true,
              name: true,
              amount: true,
              status: true,
              dueDate: true
            }
          }
        }
      },
      // Deal-level milestones come from a converted Proposal (see
      // proposals-convert.ts §3). They live on the deal itself rather than
      // a specific permit — surface them as a dedicated section above the
      // per-permit BillingMilestone groupings.
      dealMilestones: {
        orderBy: [{ orderIndex: "asc" }, { dueDate: "asc" }],
        select: {
          id: true,
          description: true,
          amount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          triggerPercentage: true
        }
      }
    }
  });

  if (!deal) {
    return <p className="text-xs text-muted-foreground">הפרויקט לא נמצא.</p>;
  }

  const allMilestones = deal.permits.flatMap((p) => p.milestones);
  // Paid total = paid BillingMilestones + paid DealMilestones (they're not
  // double-counted because they come from different sources: BillingMilestone
  // is permit-task-anchored, DealMilestone is proposal-conversion-anchored).
  const billed = allMilestones.reduce((s, m) => s + Number(m.amount), 0);
  const paid =
    allMilestones
      .filter((m) => m.status === "PAID")
      .reduce((s, m) => s + Number(m.amount), 0) +
    deal.dealMilestones
      .filter((m) => m.status === "PAID")
      .reduce((s, m) => s + Number(m.amount), 0);
  const totalValue = deal.totalValue ? Number(deal.totalValue.toString()) : null;
  const remaining = totalValue !== null ? totalValue - paid : billed - paid;

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-1.5 text-center">
        <Stat label="ערך עסקה" value={totalValue !== null ? formatILS(totalValue) : "—"} />
        <Stat label="שולם" value={formatILS(paid)} accent="success" />
        <Stat label="יתרה" value={formatILS(remaining)} accent="warning" />
      </dl>

      {/* Deal-level milestones from a converted proposal. Shown above the
          per-permit groupings because they're the contract-level payment
          schedule, not work-product billing. */}
      {deal.dealMilestones.length > 0 && (
        <div className="rounded border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
            <span className="text-[11px] font-medium">אבני דרך מהצעת מחיר</span>
            <span className="text-[10px] text-muted-foreground">
              {deal.dealMilestones.length} סה&quot;כ
            </span>
          </div>
          <ul className="divide-y">
            {deal.dealMilestones.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-2 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium">
                    {m.description}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                    {m.dueDate && <span>{formatDate(m.dueDate)}</span>}
                    {m.triggerPercentage !== null && (
                      <span>· יעד: {m.triggerPercentage}% מהמשימות</span>
                    )}
                    {m.paidAt && (
                      <span className="text-emerald-700 dark:text-emerald-300">
                        · שולם {formatDate(m.paidAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[12px] font-semibold tabular-nums">
                    {formatILS(m.amount)}
                  </span>
                  <DealMilestoneStatusControl
                    milestoneId={m.id}
                    currentStatus={m.status}
                    amountLabel={formatILS(m.amount)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {deal.permits.map((p) => (
        <div key={p.id} className="rounded border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
            <Link
              href={`/permits/${p.id}/finances`}
              className="truncate text-[11px] font-medium underline-offset-2 hover:underline"
            >
              {p.name}
            </Link>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {p.milestones.length} אבני דרך
            </span>
          </div>
          {p.milestones.length === 0 ? (
            <div className="px-2 py-2 text-[11px] text-muted-foreground">
              אין אבני דרך להיתר זה
            </div>
          ) : (
            <ul className="divide-y">
              {p.milestones.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium">{m.name}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {formatDate(m.dueDate)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[12px] font-semibold tabular-nums">
                      {formatILS(m.amount)}
                    </span>
                    <Badge variant={MILESTONE_STATUS_VARIANT[m.status]}>
                      {MILESTONE_STATUS_LABEL[m.status]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: "success" | "warning";
}) {
  return (
    <div className="rounded border bg-card px-1.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          accent === "success"
            ? "text-[12px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
            : accent === "warning"
              ? "text-[12px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
              : "text-[12px] font-semibold tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}
