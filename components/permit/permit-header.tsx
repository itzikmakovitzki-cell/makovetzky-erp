import type { Permit, Authority, Client, MasterDeal } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate } from "@/lib/utils";

type PermitWithRefs = Permit & {
  authority: Authority;
  masterDeal: MasterDeal & { client: Client };
};

export function PermitHeader({
  permit,
  progressPercent,
  taskTotal,
  taskCompleted
}: {
  permit: PermitWithRefs;
  progressPercent: number;
  taskTotal: number;
  taskCompleted: number;
}) {
  return (
    <header className="rounded-md border bg-card">
      <div className="grid grid-cols-[1fr_auto] gap-4 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-base font-semibold">{permit.name}</h1>
            {permit.permitNumber && (
              <span className="font-mono text-[11px] text-muted-foreground">{permit.permitNumber}</span>
            )}
            <Badge variant={PERMIT_STATUS_VARIANT[permit.status]}>{PERMIT_STATUS_LABEL[permit.status]}</Badge>
            {permit.type && <Badge variant="outline">{permit.type}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>רשות: <span className="text-foreground">{permit.authority.name}</span></span>
            <span aria-hidden>·</span>
            <span>לקוח: <span className="text-foreground">{permit.masterDeal.client.companyName}</span></span>
            <span aria-hidden>·</span>
            <span>עסקה: <span className="text-foreground">{permit.masterDeal.name}</span></span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 min-w-72">
          <div className="flex w-full items-center justify-between text-[11px]">
            <span className="text-muted-foreground">התקדמות</span>
            <span className="font-medium">
              {progressPercent}% <span className="text-muted-foreground">({taskCompleted}/{taskTotal})</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex w-full items-center justify-between text-[10px] text-muted-foreground">
            <span>התחלה: {formatDate(permit.startDate)}</span>
            <span>צפוי לסיום: {formatDate(permit.expectedCloseDate)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
