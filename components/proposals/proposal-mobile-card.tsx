import Link from "next/link";
import { ArrowLeft, MapPin, Phone } from "lucide-react";
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
      className="group block cursor-pointer rounded-2xl transition-transform duration-200 md:hover:-translate-y-0.5"
      aria-label={proposal.customerName}
    >
      <Card className="h-full overflow-hidden rounded-2xl border-white/80 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.07)] transition-shadow duration-200 group-hover:shadow-[0_14px_36px_rgba(31,41,55,0.12)]">
        <div aria-hidden className="h-1 bg-gradient-to-l from-primary via-brand-orange-light to-brand-cream" />
        <CardHeader className="p-4 pb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1.5">
              <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-brand-navy">
                {proposal.customerName}
              </h3>
              {proposal.convertedAt && (
                <Badge variant="success" className="shrink-0">
                  הומר
                </Badge>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3" /> {proposal.projectLocation || "ללא מיקום"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
              <Phone className="size-3" /> {proposal.customerPhone}
            </p>
          </div>
          <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
            {PROPOSAL_STATUS_LABEL[proposal.status]}
          </Badge>
        </CardHeader>

        <CardContent className="px-4 pb-4">
          <div className="text-2xl font-black tabular-nums text-brand-navy">
            {formatILS(proposal.totalAmount)}
          </div>
        </CardContent>

        <CardFooter className="min-h-12 bg-[#fbfaf7] px-4 py-3">
          <span className="text-[11px] tabular-nums text-muted-foreground">
            נוצרה {formatDate(proposal.createdAt)}
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
            {proposal.signedAt ? `נחתמה ${formatDate(proposal.signedAt)}` : "ממתינה להתקדמות"}
            <ArrowLeft className="size-3.5 text-primary transition-transform duration-200 group-hover:-translate-x-1" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
