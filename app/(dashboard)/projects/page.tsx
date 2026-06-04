import Link from "next/link";
import { Plus, ArrowLeft } from "lucide-react";
import type { PermitStatus, MasterDealStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArchiveToggle } from "@/components/global/archive-toggle";
import { PageHeader } from "@/components/global/page-header";
import { ExportListButton } from "@/components/global/export-list-button";
import { ProjectMobileCard } from "@/components/projects/project-mobile-card";
import {
  MASTER_DEAL_STATUS_LABEL,
  MASTER_DEAL_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

// A permit is "active" when it's still moving — anything except the two
// terminal statuses. Mirrors the rule on the client-detail page so the count
// is consistent across the app.
const ACTIVE_PERMIT_STATUSES: PermitStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY"
];

// Active vs archived for the master deal itself — drives the
// /projects archive toggle (mirrors the /permits version from PR #38).
const ACTIVE_DEAL_STATUSES: MasterDealStatus[] = ["ACTIVE", "ON_HOLD"];
const ARCHIVED_DEAL_STATUSES: MasterDealStatus[] = ["COMPLETED", "CANCELLED"];

export default async function ProjectsListPage({
  searchParams
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const statusFilter = showArchived ? ARCHIVED_DEAL_STATUSES : ACTIVE_DEAL_STATUSES;

  // Two counts so the toggle can show both numbers at once.
  const [activeCount, archivedCount, deals] = await Promise.all([
    prisma.masterDeal.count({
      where: { deletedAt: null, status: { in: ACTIVE_DEAL_STATUSES } }
    }),
    prisma.masterDeal.count({
      where: { deletedAt: null, status: { in: ARCHIVED_DEAL_STATUSES } }
    }),
    // Block 23: the projects overview is intentionally money-free — financial
    // roll-ups live only in /finances. Per permit we pull just task.status for
    // the progress bars.
    prisma.masterDeal.findMany({
      where: { deletedAt: null, status: { in: statusFilter } },
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
            }
          }
        }
      }
    })
  ]);

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
      progressPercent
    };
  });

  return (
    <section className="flex flex-col gap-3">
      <PageHeader
        title="פרויקטים"
        accent="Master Deals"
        description="תצוגה ברמת הפרויקט. כל פרויקט מכיל היתר אחד או יותר. לחץ על שורה כדי לראות את ההיתרים תחתיו."
        action={
          <div className="flex items-center gap-2">
            <ExportListButton kind="projects" />
            <Button asChild variant="cta" className="h-9">
              <Link href="/permits/new">
                <Plus className="size-3.5" />
                פרויקט חדש
              </Link>
            </Button>
          </div>
        }
      />

      <div>
        <ArchiveToggle
          active={showArchived ? "archived" : "active"}
          activeCount={activeCount}
          archivedCount={archivedCount}
        />
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {rows.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            {showArchived
              ? "אין פרויקטים שהושלמו"
              : 'אין פרויקטים — לחץ "פרויקט חדש" כדי להוסיף אחד.'}
          </div>
        ) : (
          rows.map((r) => <ProjectMobileCard key={r.id} project={r} />)
        )}
      </div>

      <div className="hidden md:block rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {showArchived ? "פרויקטים שהושלמו" : "פרויקטים פעילים"} ({rows.length})
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
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  {showArchived
                    ? "אין פרויקטים שהושלמו"
                    : 'אין פרויקטים — לחץ "פרויקט חדש" כדי להוסיף אחד.'}
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
