import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { MILESTONE_STATUS_LABEL, MILESTONE_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate, formatILS } from "@/lib/utils";

export async function FinanceSummary({ permitId }: { permitId: string }) {
  const milestones = await prisma.billingMilestone.findMany({
    where: { permitId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });

  const totalAmount = milestones.reduce((s, m) => s + Number(m.amount), 0);
  const paidAmount = milestones
    .filter((m) => m.status === "PAID")
    .reduce((s, m) => s + Number(m.amount), 0);
  const pendingAmount = totalAmount - paidAmount;

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-3 gap-1 text-center">
        <Stat label='סה"כ' value={formatILS(totalAmount)} />
        <Stat label="שולם" value={formatILS(paidAmount)} accent="success" />
        <Stat label="פתוח" value={formatILS(pendingAmount)} accent="warning" />
      </dl>

      <div className="rounded border">
        <div className="border-b bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          אבני דרך ({milestones.length})
        </div>
        <ul className="divide-y">
          {milestones.length === 0 && (
            <li className="px-2 py-2 text-[11px] text-muted-foreground">אין אבני דרך</li>
          )}
          {milestones.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{m.name}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {formatDate(m.dueDate)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[12px] font-semibold tabular-nums">{formatILS(m.amount)}</span>
                <Badge variant={MILESTONE_STATUS_VARIANT[m.status]}>
                  {MILESTONE_STATUS_LABEL[m.status]}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
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
