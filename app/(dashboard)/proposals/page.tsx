import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import type { Prisma, ProposalStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/global/page-header";
import { ProposalMobileCard } from "@/components/proposals/proposal-mobile-card";
import { ProposalRowActions } from "@/components/proposals/proposal-row-actions";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_VARIANT
} from "@/lib/status-maps";
import { formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<ProposalStatus>([
  "DRAFT",
  "SENT",
  "SIGNED",
  "REJECTED"
]);

const STATUS_ORDER: ProposalStatus[] = [
  "DRAFT",
  "SENT",
  "SIGNED",
  "REJECTED"
];

export default async function ProposalsListPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const statusParam =
    typeof params.status === "string" ? params.status : undefined;

  const statusFilter =
    statusParam && VALID_STATUSES.has(statusParam as ProposalStatus)
      ? (statusParam as ProposalStatus)
      : null;

  const where: Prisma.ProposalWhereInput = { deletedAt: null };
  if (statusFilter) where.status = statusFilter;

  const proposals = await prisma.proposal.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      projectLocation: true,
      totalAmount: true,
      status: true,
      signedAt: true,
      convertedAt: true,
      createdAt: true,
      createdBy: { select: { name: true } }
    }
  });

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="הצעות מחיר"
        description={'הצעות עצמאיות לליד — לא תופסות מקום ב"לקוחות" עד שנחתמות והומרו לפרויקט.'}
        action={
          <Button asChild variant="cta" className="h-9">
            <Link href="/proposals/new">
              <Plus className="size-3.5" />
              הצעה חדשה
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          סטטוס
        </span>
        <FilterPill
          href="/proposals"
          label="הכל"
          active={!statusFilter}
        />
        {STATUS_ORDER.map((s) => (
          <FilterPill
            key={s}
            href={`/proposals?status=${s}`}
            label={PROPOSAL_STATUS_LABEL[s]}
            active={statusFilter === s}
          />
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2">
        <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          תוצאות ({proposals.length})
        </div>
        {proposals.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין הצעות תואמות לסינון
          </div>
        ) : (
          proposals.map((p) => <ProposalMobileCard key={p.id} proposal={p} />)
        )}
      </div>

      <div className="hidden md:block overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/60 bg-muted/40 px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תוצאות ({proposals.length})
          </h2>
        </div>

        <table className="table-loose table-sticky-head">
          <thead>
            <tr>
              <th>לקוח</th>
              <th className="w-36">טלפון</th>
              <th className="w-44">מיקום</th>
              <th className="w-32">סטטוס</th>
              <th className="w-32 text-end">סכום</th>
              <th className="w-28">נחתמה</th>
              <th className="w-28">נוצרה</th>
              <th className="w-28">נוצרה ע"י</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  אין הצעות תואמות לסינון
                </td>
              </tr>
            )}
            {proposals.map((p) => (
              <tr key={p.id} className="group hover:bg-muted/50">
                <td>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/proposals/${p.id}`}
                      className="font-medium text-foreground underline-offset-2 transition-colors group-hover:underline"
                    >
                      {p.customerName}
                    </Link>
                    {p.convertedAt && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                        הומר לפרויקט
                      </span>
                    )}
                  </div>
                </td>
                <td className="tabular-nums text-foreground/80">{p.customerPhone}</td>
                <td className="truncate text-foreground/80" title={p.projectLocation ?? undefined}>
                  {p.projectLocation ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td>
                  <Badge variant={PROPOSAL_STATUS_VARIANT[p.status]}>
                    {PROPOSAL_STATUS_LABEL[p.status]}
                  </Badge>
                </td>
                <td className="text-end font-medium tabular-nums text-foreground">
                  {formatILS(p.totalAmount)}
                </td>
                <td className="tabular-nums text-muted-foreground">
                  {p.signedAt ? formatDate(p.signedAt) : "—"}
                </td>
                <td className="tabular-nums text-muted-foreground">
                  {formatDate(p.createdAt)}
                </td>
                <td className="text-foreground/80">
                  {p.createdBy?.name ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="p-1 text-center">
                  <ProposalRowActions
                    proposalId={p.id}
                    customerName={p.customerName}
                    status={p.status}
                    isConverted={!!p.convertedAt}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterPill({
  href,
  label,
  active
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded border border-foreground bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background"
          : "rounded border border-input bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      }
    >
      {label}
    </Link>
  );
}
