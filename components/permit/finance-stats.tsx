import { Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn, formatILS } from "@/lib/utils";

export function FinanceStats({
  dealValue,
  paidAmount,
  pendingAmount,
  dueAmount
}: {
  dealValue: number;
  paidAmount: number;
  pendingAmount: number;
  dueAmount: number;
}) {
  const balance = dealValue - paidAmount;

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        label="ערך עסקה כולל"
        value={formatILS(dealValue)}
        icon={<Wallet className="size-4 text-muted-foreground" />}
        helper={`לפי MasterDeal`}
      />
      <StatCard
        label="שולם עד כה"
        value={formatILS(paidAmount)}
        icon={<CheckCircle2 className="size-4 text-emerald-600" />}
        helper={dealValue > 0 ? `${Math.round((paidAmount / dealValue) * 100)}% מהעסקה` : "—"}
        accent="success"
      />
      <StatCard
        label="יתרה לתשלום"
        value={formatILS(balance)}
        icon={
          dueAmount > 0 ? (
            <AlertTriangle className="size-4 text-amber-600" />
          ) : (
            <Wallet className="size-4 text-muted-foreground" />
          )
        }
        helper={
          dueAmount > 0
            ? `${formatILS(dueAmount)} ממתין לתשלום (מועד הגיע)`
            : pendingAmount > 0
              ? `${formatILS(pendingAmount)} עוד לא הופעלה אבן דרך`
              : "אין יתרה פתוחה"
        }
        accent={dueAmount > 0 ? "warning" : undefined}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  helper,
  accent
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  helper: string;
  accent?: "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2.5",
        accent === "warning" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums leading-tight",
          accent === "success" && "text-emerald-700 dark:text-emerald-300",
          accent === "warning" && "text-amber-800 dark:text-amber-300"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{helper}</div>
    </div>
  );
}
