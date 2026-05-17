import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import type { Prisma, ProposalStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <FileText className="size-4" />
            הצעות מחיר
          </h1>
          <p className="text-[11px] text-muted-foreground">
            הצעות עצמאיות לליד — לא תופסות מקום ב"לקוחות" עד שנחתמות והומרו לפרויקט.
          </p>
        </div>
        <Link
          href="/proposals/new"
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          הצעה חדשה
        </Link>
      </header>

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

      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תוצאות ({proposals.length})
          </h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>לקוח</th>
              <th className="w-32">טלפון</th>
              <th className="w-40">מיקום</th>
              <th className="w-28">סטטוס</th>
              <th className="w-28 text-end">סכום</th>
              <th className="w-28">נחתמה</th>
              <th className="w-28">נוצרה</th>
              <th className="w-24">נוצרה ע"י</th>
            </tr>
          </thead>
          <tbody>
            {proposals.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                  אין הצעות תואמות לסינון
                </td>
              </tr>
            )}
            {proposals.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td>
                  <Link
                    href={`/proposals/${p.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {p.customerName}
                  </Link>
                  {p.convertedAt && (
                    <span className="ms-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-800 dark:text-emerald-200">
                      הומר לפרויקט
                    </span>
                  )}
                </td>
                <td className="text-xs tabular-nums">{p.customerPhone}</td>
                <td className="truncate text-xs" title={p.projectLocation ?? undefined}>
                  {p.projectLocation ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td>
                  <Badge variant={PROPOSAL_STATUS_VARIANT[p.status]}>
                    {PROPOSAL_STATUS_LABEL[p.status]}
                  </Badge>
                </td>
                <td className="text-end text-xs tabular-nums">
                  {formatILS(p.totalAmount)}
                </td>
                <td className="text-xs tabular-nums text-muted-foreground">
                  {p.signedAt ? formatDate(p.signedAt) : "—"}
                </td>
                <td className="text-xs tabular-nums text-muted-foreground">
                  {formatDate(p.createdAt)}
                </td>
                <td className="text-xs">
                  {p.createdBy?.name ?? <span className="text-muted-foreground">—</span>}
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
