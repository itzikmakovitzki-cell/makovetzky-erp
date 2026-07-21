import Link from "next/link";
import { ArrowLeft, Building2, ListChecks, Landmark } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

export type PermitMobileCardData = Prisma.PermitGetPayload<{
  include: {
    authority: { select: { name: true } };
    masterDeal: { include: { client: { select: { companyName: true } } } };
    _count: { select: { tasks: true; buildings: true } };
  };
}>;

export function PermitMobileCard({
  permit,
  completionPct
}: {
  permit: PermitMobileCardData;
  completionPct: number;
}) {
  return (
    <Link
      href={`/permits/${permit.id}/tasks`}
      className="group block cursor-pointer rounded-2xl transition-transform duration-200 md:hover:-translate-y-0.5"
      aria-label={permit.name}
    >
      <Card className="h-full overflow-hidden rounded-2xl border-white/80 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.07)] transition-shadow duration-200 group-hover:shadow-[0_14px_36px_rgba(31,41,55,0.12)]">
        <div aria-hidden className="h-1 bg-gradient-to-l from-primary via-brand-orange-light to-brand-cream" />
        <CardHeader className="p-4 pb-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-brand-navy">
              {permit.name}
            </h3>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Landmark className="size-3 shrink-0" /> {permit.masterDeal.client.companyName} · {permit.authority.name}
            </p>
            {permit.permitNumber && (
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                {permit.permitNumber}
              </p>
            )}
          </div>
          <Badge variant={PERMIT_STATUS_VARIANT[permit.status]}>
            {PERMIT_STATUS_LABEL[permit.status]}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-2 px-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  completionPct === 100 ? "bg-emerald-500" : "bg-sky-500"
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="w-11 text-end text-sm font-extrabold tabular-nums text-brand-navy">
              {completionPct}%
            </span>
          </div>
        </CardContent>

        <CardFooter className="min-h-12 bg-[#fbfaf7] px-4 py-3">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ListChecks className="size-3" />
              <span className="tabular-nums">{permit._count.tasks}</span>
              <span>משימות</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" />
              <span className="tabular-nums">{permit._count.buildings}</span>
              <span>בניינים</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            {permit.expectedCloseDate ? formatDate(permit.expectedCloseDate) : "ללא יעד"}
            <ArrowLeft className="size-3.5 text-primary transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
