import Link from "next/link";
import { Building2, ListChecks } from "lucide-react";
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
      className="block transition-colors active:bg-muted/40"
      aria-label={permit.name}
    >
      <Card>
        <CardHeader>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
              {permit.name}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {permit.masterDeal.client.companyName} · {permit.authority.name}
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

        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  completionPct === 100 ? "bg-emerald-500" : "bg-sky-500"
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="w-10 text-end text-[11px] font-medium tabular-nums text-foreground">
              {completionPct}%
            </span>
          </div>
        </CardContent>

        <CardFooter>
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
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {permit.expectedCloseDate ? formatDate(permit.expectedCloseDate) : "—"}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
