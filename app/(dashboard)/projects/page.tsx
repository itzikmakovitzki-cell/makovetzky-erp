import Link from "next/link";
import { FolderKanban, Plus, ArrowLeft } from "lucide-react";
import type { PermitStatus, MasterDealStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ClientModeShield } from "@/components/global/client-mode-shield";
import { MoneyCell } from "@/components/global/money-cell";
import {
  MASTER_DEAL_STATUS_LABEL,
  MASTER_DEAL_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A permit is "active" when it's still moving — anything except the two
// terminal statuses. Mirrors the rule on the client-detail page so the count
// is consistent across the app.
const ACTIVE_PERMIT_STATUSES: PermitStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY"
];

export default async function ProjectsListPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  // Load deals with the minimum needed for aggregation. Per permit we pull
  // only task.status (one enum field) and for admins also milestones
  // (status + amount). Volumes are well within "fits in a single page" for
  // an SMB ERP — if this ever grows past a few hundred deals we should switch
  // to SQL aggregates.
  const deals = await prisma.masterDeal.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      client: { select: { id: true, companyName: true } },
      permits: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          tasks: {
            where: { deletedAt: null },
            select: { status: true }
          },
          ...(isAdmin
            ? {
                milestones: {
                  select: { status: true, amount: true }
                }
              }
            : {})
        }
      }
    }
  });

  // Roll up per deal in JS. Cheap — at most a few thousand task rows.
  const rows = deals.map((d) => {
    const totalPermits = d.permits.length;
    const activePermits = d.permits.filter((p) =>
      ACTIVE_PERMIT_STATUSES.includes(p.status)
    ).length;
    let totalTasks = 0;
    let completedTasks = 0;
    for (const p of d.permits) {
      totalTasks += p.tasks.length;
      for (const t of p.tasks) {
        if (t.status === "COMPLETED") completedTasks++;
      }
    }
    const progressPercent =
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    let paidSum = 0;
    let pendingSum = 0;
    if (isAdmin) {
      for (const p of d.permits) {
        const milestones = (p as unknown as { milestones?: { status: string; amount: unknown }[] }).milestones ?? [];
        for (const m of milestones) {
          const value = Number((m.amount as { toString(): string }).toString());
          if (m.status === "PAID") paidSum += value;
          else pendingSum += value;
        }
      }
    }
    const totalValue = d.totalValue ? Number(d.totalValue.toString()) : null;

    return {
      id: d.id,
      name: d.name,
      status: d.status as MasterDealStatus,
      clientId: d.client.id,
      clientName: d.client.companyName,
      contractDate: d.contractDate,
      createdAt: d.createdAt,
      totalPermits,
      activePermits,
      totalTasks,
      completedTasks,
      progressPercent,
      totalValue,
      paidSum,
      pendingSum
    };
  });

  const grandTotals = isAdmin
    ? rows.reduce(
        (acc, r) => ({
          totalValue: acc.totalValue + (r.totalValue ?? 0),
          paid: acc.paid + r.paidSum,
          pending: acc.pending + r.pendingSum
        }),
        { totalValue: 0, paid: 0, pending: 0 }
      )
    : null;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold">
            <FolderKanban className="size-5 text-muted-foreground" />
            פרויקטים — Master Deals
          </h1>
          <p className="text-[11px] text-muted-foreground">
            תצוגה ברמת הפרויקט. כל פרויקט מכיל היתר אחד או יותר. לחץ על שורה כדי לראות את ההיתרים תחתיו.
          </p>
        </div>
        <Link
          href="/permits/new"
          className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          פרויקט חדש
        </Link>
      </header>

      {isAdmin && grandTotals && (
        <ClientModeShield
          title="סיכום פיננסי"
          subtitle="ערך, גבייה ויתרה לחיוב — מוסתר כברירת מחדל"
        >
          <div className="grid grid-cols-3 gap-2">
            <SummaryStat
              label="ערך פרויקטים כולל"
              value={formatILS(grandTotals.totalValue)}
              hint={`${rows.length} פרויקטים`}
            />
            <SummaryStat
              label="שולם עד כה"
              value={formatILS(grandTotals.paid)}
              hint={
                grandTotals.totalValue > 0
                  ? `${Math.round((grandTotals.paid / grandTotals.totalValue) * 100)}% מהערך הכולל`
                  : "—"
              }
              accent="success"
            />
            <SummaryStat
              label="יתרה לחיוב"
              value={formatILS(grandTotals.pending)}
              hint="סך אבני דרך שטרם שולמו"
              accent="warning"
            />
          </div>
        </ClientModeShield>
      )}

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            כל הפרויקטים ({rows.length})
          </h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>שם פרויקט</th>
              <th>לקוח</th>
              <th className="w-24">סטטוס</th>
              <th className="w-24">היתרים</th>
              <th>התקדמות משימות</th>
              <th className="w-28">חוזה / נוצר</th>
              {isAdmin && <th className="w-28 text-end">ערך כולל</th>}
              {isAdmin && <th className="w-28 text-end">שולם / יתרה</th>}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 9 : 7}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  אין פרויקטים — לחץ &quot;פרויקט חדש&quot; כדי להוסיף אחד.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-muted/30">
                <td>
                  <Link
                    href={`/projects/${r.id}`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="text-[12px]">
                  <Link
                    href={`/clients/${r.clientId}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {r.clientName}
                  </Link>
                </td>
                <td>
                  <Badge variant={MASTER_DEAL_STATUS_VARIANT[r.status]}>
                    {MASTER_DEAL_STATUS_LABEL[r.status]}
                  </Badge>
                </td>
                <td className="text-[12px] tabular-nums">
                  <span className="font-medium">{r.activePermits}</span>
                  <span className="text-muted-foreground"> פעילים · {r.totalPermits} סה&quot;כ</span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded bg-muted">
                      <div
                        className={cn(
                          "h-full bg-emerald-500",
                          r.progressPercent === 100 && "bg-emerald-600"
                        )}
                        style={{ width: `${r.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {r.completedTasks}/{r.totalTasks} · {r.progressPercent}%
                    </span>
                  </div>
                </td>
                <td className="text-[10px] tabular-nums text-muted-foreground">
                  {r.contractDate ? (
                    <>חוזה: {formatDate(r.contractDate)}</>
                  ) : (
                    <span>נוצר: {formatDate(r.createdAt)}</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="text-end text-[12px] tabular-nums font-medium">
                    <MoneyCell>
                      {r.totalValue !== null ? formatILS(r.totalValue) : "—"}
                    </MoneyCell>
                  </td>
                )}
                {isAdmin && (
                  <td className="text-end text-[11px] tabular-nums">
                    <MoneyCell>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {formatILS(r.paidSum)}
                      </span>
                      {r.pendingSum > 0 && (
                        <>
                          <span className="text-muted-foreground"> · </span>
                          <span className="text-amber-700 dark:text-amber-300">
                            {formatILS(r.pendingSum)}
                          </span>
                        </>
                      )}
                    </MoneyCell>
                  </td>
                )}
                <td>
                  <Link
                    href={`/projects/${r.id}`}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="פתח פרויקט"
                  >
                    <ArrowLeft className="size-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  hint,
  accent
}: {
  label: string;
  value: string;
  hint: string;
  accent?: "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        accent === "success" &&
          "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-500/5",
        accent === "warning" &&
          "border-amber-500/40 bg-amber-50/40 dark:bg-amber-500/5"
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[14px] font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
