import Link from "next/link";
import { Plus, FolderKanban, Building2, CheckCircle2 } from "lucide-react";
import type { PermitStatus, MasterDealStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ArchiveToggle } from "@/components/global/archive-toggle";
import { ExportListButton } from "@/components/global/export-list-button";
import { ProjectMobileCard } from "@/components/projects/project-mobile-card";

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

  const activePermitsTotal = rows.reduce((sum, row) => sum + row.activePermits, 0);
  const averageProgress = rows.length === 0
    ? 0
    : Math.round(rows.reduce((sum, row) => sum + row.progressPercent, 0) / rows.length);

  return (
    <section className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-5 py-6 text-brand-cream shadow-[0_18px_55px_rgba(31,41,55,0.16)] md:px-8 md:py-8">
        <div aria-hidden className="absolute -start-20 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-cream/80">
              <FolderKanban className="size-3.5 text-primary" /> תיק הפרויקטים
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">כל העבודה, בתמונה אחת</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-brand-cream/72 md:text-base">
              כל פרויקט הוא עולם קטן. כאן רואים מי מתקדם, מי מחכה ומה כדאי לפתוח עכשיו.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportListButton kind="projects" />
            <Button asChild variant="cta" size="pill">
              <Link href="/permits/new">
                <Plus className="size-4" /> פרויקט חדש
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 md:max-w-2xl md:gap-3">
        <PortfolioMetric icon={<FolderKanban className="size-4" />} value={rows.length} label={showArchived ? "שהושלמו" : "פרויקטים פעילים"} />
        <PortfolioMetric icon={<Building2 className="size-4" />} value={activePermitsTotal} label="היתרים פעילים" />
        <PortfolioMetric icon={<CheckCircle2 className="size-4" />} value={`${averageProgress}%`} label="התקדמות ממוצעת" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ArchiveToggle
          active={showArchived ? "archived" : "active"}
          activeCount={activeCount}
          archivedCount={archivedCount}
        />
        <span className="text-xs text-muted-foreground">לחיצה על כרטיס פותחת את כל פרטי הפרויקט</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed bg-white/70 px-5 py-14 text-center text-sm text-muted-foreground">
            {showArchived
              ? "אין פרויקטים שהושלמו"
              : 'אין פרויקטים — לחץ "פרויקט חדש" כדי להוסיף אחד.'}
          </div>
        ) : (
          rows.map((r) => <ProjectMobileCard key={r.id} project={r} />)
        )}
      </div>
    </section>
  );
}

function PortfolioMetric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_6px_20px_rgba(31,41,55,0.055)] md:p-4">
      <div className="text-primary">{icon}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-brand-navy tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground md:text-xs">{label}</div>
    </div>
  );
}
