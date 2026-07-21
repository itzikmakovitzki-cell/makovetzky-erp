import type { Permit, Authority, Client, MasterDeal } from "@prisma/client";
import { auth } from "@/auth";
import { deletePermit } from "@/app/actions/permits";
import { Badge } from "@/components/ui/badge";
import { SoftDeleteButton } from "@/components/global/soft-delete-button";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate } from "@/lib/utils";

type PermitWithRefs = Permit & {
  authority: Authority;
  masterDeal: MasterDeal & { client: Client };
};

export async function PermitHeader({
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
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  return (
    <header className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 shadow-[0_14px_44px_rgba(31,41,55,0.09)]">
      <div aria-hidden className="absolute -start-24 -top-28 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-6 p-5 md:p-7 lg:grid-cols-[1fr_minmax(18rem,25rem)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-brand-navy md:text-3xl">{permit.name}</h1>
            {permit.permitNumber && (
              <span className="font-mono text-[11px] text-muted-foreground">{permit.permitNumber}</span>
            )}
            <Badge variant={PERMIT_STATUS_VARIANT[permit.status]}>{PERMIT_STATUS_LABEL[permit.status]}</Badge>
            {permit.type && <Badge variant="outline">{permit.type}</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>רשות: <span className="text-foreground">{permit.authority.name}</span></span>
            <span aria-hidden>·</span>
            <span>לקוח: <span className="text-foreground">{permit.masterDeal.client.companyName}</span></span>
            <span aria-hidden>·</span>
            <span>עסקה: <span className="text-foreground">{permit.masterDeal.name}</span></span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border/60 bg-[#fbfaf7] p-4">
          <div className="flex w-full items-center justify-between text-xs">
            <span className="text-muted-foreground">התקדמות</span>
            <span className="font-medium">
              {progressPercent}% <span className="text-muted-foreground">({taskCompleted}/{taskTotal})</span>
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded bg-emerald-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-1 text-[11px] text-muted-foreground">
            <span>התחלה: {formatDate(permit.startDate)}</span>
            <span>צפוי לסיום: {formatDate(permit.expectedCloseDate)}</span>
          </div>
          {isAdmin && (
            <div className="mt-1.5 self-end">
              <SoftDeleteButton
                action={deletePermit}
                id={permit.id}
                label={permit.name}
                buttonLabel="מחק היתר"
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
