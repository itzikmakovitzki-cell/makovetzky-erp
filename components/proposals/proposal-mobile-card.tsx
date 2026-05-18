import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PROPOSAL_STATUS_LABEL, PROPOSAL_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate, formatILS } from "@/lib/utils";

export type ProposalMobileCardData = Prisma.ProposalGetPayload<{
  select: {
    id: true;
    customerName: true;
    customerPhone: true;
    projectLocation: true;
    totalAmount: true;
    status: true;
    signedAt: true;
    convertedAt: true;
    createdAt: true;
    createdBy: { select: { name: true } };
  };
}>;

export function ProposalMobileCard({ proposal }: { proposal: ProposalMobileCardData }) {
  return (
    <Link
      href={`/proposals/${proposal.id}`}
      className="block transition-colors active:bg-muted/40"
      aria-label={proposal.customerName}
    >
      <Card>
        <CardHeader>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h3 className="text-sm font-medium leading-snug text-foreground line-clamp-2">
                {proposal.customerName}
              </h3>
              {proposal.convertedAt && (
                <Badge variant="success" className="shrink-0">
                  הומר
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {proposal.projectLocation || "—"}
            </p>
            <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
              {proposal.customerPhone}
            </p>
          </div>
          <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
            {PROPOSAL_STATUS_LABEL[proposal.status]}
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="text-base font-semibold tabular-nums text-foreground">
            {formatILS(proposal.totalAmount)}
          </div>
        </CardContent>

        <CardFooter>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            נוצרה {formatDate(proposal.createdAt)}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {proposal.signedAt ? `נחתמה ${formatDate(proposal.signedAt)}` : "—"}
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
