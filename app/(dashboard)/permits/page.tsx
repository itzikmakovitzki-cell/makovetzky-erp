import Link from "next/link";
import { Building2, CheckCircle2, FileCheck2, FolderPlus } from "lucide-react";
import type { PermitStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { ExportListButton } from "@/components/global/export-list-button";
import { PermitMobileCard } from "@/components/permits/permit-mobile-card";
import { ArchiveToggle } from "@/components/global/archive-toggle";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES: PermitStatus[] = ["DRAFT", "IN_PROGRESS", "AWAITING_AUTHORITY"];
const ARCHIVED_STATUSES: PermitStatus[] = ["COMPLETED", "CANCELLED"];

export default async function PermitsListPage({
  searchParams
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const { archived } = await searchParams;
  const showArchived = archived === "1";
  const statusFilter = showArchived ? ARCHIVED_STATUSES : ACTIVE_STATUSES;

  const [activeCount, archivedCount, permits] = await Promise.all([
    prisma.permit.count({ where: { deletedAt: null, status: { in: ACTIVE_STATUSES } } }),
    prisma.permit.count({ where: { deletedAt: null, status: { in: ARCHIVED_STATUSES } } }),
    prisma.permit.findMany({
      where: { deletedAt: null, status: { in: statusFilter } },
      orderBy: { createdAt: "desc" },
      include: {
        authority: { select: { name: true } },
        masterDeal: { include: { client: { select: { companyName: true } } } },
        tasks: { where: { deletedAt: null }, select: { status: true } },
        _count: { select: { tasks: { where: { deletedAt: null } }, buildings: true } }
      }
    })
  ]);

  const completionByPermit = new Map(
    permits.map((permit) => {
      const completed = permit.tasks.filter((task) => task.status === "COMPLETED").length;
      const pct = permit._count.tasks === 0 ? 0 : Math.round((completed / permit._count.tasks) * 100);
      return [permit.id, pct] as const;
    })
  );
  const averageProgress = permits.length === 0
    ? 0
    : Math.round(
        permits.reduce((sum, permit) => sum + (completionByPermit.get(permit.id) ?? 0), 0) /
          permits.length
      );
  const authorityCount = new Set(permits.map((permit) => permit.authority.name)).size;

  return (
    <section className="flex flex-col gap-6">
      <header className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-5 py-6 text-brand-cream shadow-[0_18px_55px_rgba(31,41,55,0.16)] md:px-8 md:py-8">
        <div aria-hidden className="absolute -start-20 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-brand-cream/80">
              <FileCheck2 className="size-3.5 text-primary" /> מרכז ההיתרים
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">רואים בדיוק מה מתקדם</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-brand-cream/72 md:text-base">
              כל היתר, הרשות שמולו וההתקדמות שלו — במקום אחד שקל לסרוק וקל לפעול ממנו.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportListButton kind="permits" />
            {isAdmin && (
              <Button asChild variant="cta" size="pill">
                <Link href="/permits/new"><FolderPlus className="size-4" /> פרויקט חדש</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 md:max-w-2xl md:gap-3">
        <PermitMetric icon={<FileCheck2 className="size-4" />} value={permits.length} label={showArchived ? "היתרים שהושלמו" : "היתרים בתנועה"} />
        <PermitMetric icon={<Building2 className="size-4" />} value={authorityCount} label="רשויות פעילות" />
        <PermitMetric icon={<CheckCircle2 className="size-4" />} value={`${averageProgress}%`} label="התקדמות ממוצעת" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ArchiveToggle active={showArchived ? "archived" : "active"} activeCount={activeCount} archivedCount={archivedCount} />
        <span className="text-xs text-muted-foreground">לחיצה על כרטיס פותחת את משימות ההיתר</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {permits.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed bg-white/70 px-5 py-14 text-center text-sm text-muted-foreground">
            {showArchived ? "אין היתרים שהושלמו" : "אין היתרים פעילים"}
          </div>
        ) : (
          permits.map((permit) => (
            <PermitMobileCard key={permit.id} permit={permit} completionPct={completionByPermit.get(permit.id) ?? 0} />
          ))
        )}
      </div>
    </section>
  );
}

function PermitMetric({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_6px_20px_rgba(31,41,55,0.055)] md:p-4">
      <div className="text-primary">{icon}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-brand-navy tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground md:text-xs">{label}</div>
    </div>
  );
}
