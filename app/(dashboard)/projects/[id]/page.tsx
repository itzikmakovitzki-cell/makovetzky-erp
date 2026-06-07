import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  FolderKanban,
  MessageCircle,
  StickyNote,
  Wallet
} from "lucide-react";
import type { PermitStatus, MasterDealStatus } from "@prisma/client";
import { Printer } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteMasterDeal } from "@/app/actions/permits";
import { Badge } from "@/components/ui/badge";
import { SheetButton } from "@/components/global/sheet-button";
import { SoftDeleteButton } from "@/components/global/soft-delete-button";
import { DealFinanceSummary } from "@/components/projects/deal-finance-summary";
import { MasterDealStatusControl } from "@/components/projects/master-deal-status-control";
import {
  MASTER_DEAL_STATUS_LABEL,
  MASTER_DEAL_STATUS_VARIANT,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";
import { AddPermitDialogTrigger } from "@/components/projects/add-permit-dialog";

export const dynamic = "force-dynamic";

const ACTIVE_PERMIT_STATUSES: PermitStatus[] = [
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY"
];

export default async function ProjectDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  // Authorities + building types feed the AddPermitDialog dropdowns. We fetch
  // them in parallel with the deal — small payloads, both used in the same
  // render so there's no point in deferring.
  const [deal, authorities, buildingTypes] = await Promise.all([
    prisma.masterDeal.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, companyName: true } },
      permits: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          authority: { select: { name: true } },
          tasks: {
            where: { deletedAt: null },
            select: { status: true }
          },
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
              buildings: true,
              documents: { where: { deletedAt: null } }
            }
          }
        }
      }
    }
  }),
    prisma.authority.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.buildingType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  if (!deal) notFound();

  const totalPermits = deal.permits.length;
  const activePermits = deal.permits.filter((p) =>
    ACTIVE_PERMIT_STATUSES.includes(p.status)
  ).length;
  let totalTasks = 0;
  let completedTasks = 0;
  for (const p of deal.permits) {
    totalTasks += p.tasks.length;
    for (const t of p.tasks) if (t.status === "COMPLETED") completedTasks++;
  }
  const progressPercent =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לכל הפרויקטים
        </Link>
      </div>

      <header className="rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="inline-flex items-center gap-2 text-base font-semibold">
              <FolderKanban className="size-4 text-muted-foreground" />
              {deal.name}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <Building2 className="size-2.5" />
              <Link
                href={`/clients/${deal.client.id}`}
                className="underline-offset-2 hover:underline"
              >
                {deal.client.companyName}
              </Link>
              {deal.contractDate && (
                <span>· חוזה: {formatDate(deal.contractDate)}</span>
              )}
              <span>· נוצר: {formatDate(deal.createdAt)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isAdmin ? (
              <MasterDealStatusControl
                dealId={deal.id}
                currentStatus={deal.status as MasterDealStatus}
              />
            ) : (
              <Badge variant={MASTER_DEAL_STATUS_VARIANT[deal.status as MasterDealStatus]}>
                {MASTER_DEAL_STATUS_LABEL[deal.status as MasterDealStatus]}
              </Badge>
            )}
            <Link
              href={`/projects/${deal.id}/print`}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-[11px] hover:bg-accent"
              title="סיכום פרויקט להדפסה / שמירה כ-PDF"
            >
              <Printer className="size-3" />
              סיכום להדפסה
            </Link>
            {isAdmin && (
              <Link
                href={`/projects/${deal.id}/whatsapp`}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-card px-2 py-1 text-[11px] hover:bg-accent"
                title="חיבור קבוצת WhatsApp + שליחת עדכון"
              >
                <MessageCircle className="size-3 text-emerald-600" />
                WhatsApp
              </Link>
            )}
            {/* Block 23: deal financials are hidden by default — admins open the
                drawer to view value, billing milestones, and outstanding balance. */}
            {isAdmin && (
              <SheetButton
                label="ניהול פיננסי"
                title={`ניהול פיננסי — ${deal.name}`}
                tone="finance"
                icon={<Wallet className="size-3.5" />}
              >
                <DealFinanceSummary dealId={deal.id} />
              </SheetButton>
            )}
            {isAdmin && (
              <SoftDeleteButton
                action={deleteMasterDeal}
                id={deal.id}
                label={deal.name}
                buttonLabel="מחק פרוייקט"
                redirectTo="/projects"
                confirmMessage={
                  totalPermits === 0
                    ? `למחוק את הפרוייקט "${deal.name}"?\n\nהפרוייקט יעבור לסל המחזור.`
                    : `למחוק את הפרוייקט "${deal.name}"?\n\nזה ימחק גם את ${totalPermits} ההיתרים שתחתיו, ${totalTasks} המשימות וכל המסמכים המקושרים.\nהכל יעבור לסל המחזור — ניתן לשחזר מ-הגדרות → סל המחזור.`
                }
              />
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Stat label="היתרים בפרויקט" value={`${activePermits} פעילים · ${totalPermits} סה"כ`} />
          <Stat label="משימות" value={`${completedTasks}/${totalTasks} (${progressPercent}%)`} />
        </div>

        {totalTasks > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>התקדמות משימות בכל ההיתרים</span>
              <span className="tabular-nums">{progressPercent}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full bg-emerald-500",
                  progressPercent === 100 && "bg-emerald-600"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {deal.notes && (
          <div className="mt-3 flex gap-2 rounded border bg-muted/30 px-2.5 py-1.5 text-[11px]">
            <StickyNote className="size-3 shrink-0 text-muted-foreground" />
            <span className="whitespace-pre-wrap text-muted-foreground">{deal.notes}</span>
          </div>
        )}
      </header>

      <section className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">היתרים בפרויקט</h2>
        <AddPermitDialogTrigger
          masterDealId={deal.id}
          dealName={deal.name}
          dealLocked={deal.status === "COMPLETED" || deal.status === "CANCELLED"}
          authorities={authorities}
          buildingTypes={buildingTypes}
        />
      </section>

      <div className="rounded-md border bg-card">
        <table>
          <thead>
            <tr>
              <th>שם היתר</th>
              <th className="w-32">מספר היתר</th>
              <th className="w-32">רשות</th>
              <th className="w-24">סטטוס</th>
              <th>התקדמות</th>
              <th className="w-20">משימות</th>
              <th className="w-20">בניינים</th>
              <th className="w-20">מסמכים</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {deal.permits.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
                  אין היתרים תחת הפרויקט הזה — לחץ &quot;הוסף היתר&quot; למעלה כדי להוסיף אחד.
                </td>
              </tr>
            )}
            {deal.permits.map((p) => {
              const taskTotal = p._count.tasks;
              const taskDone = p.tasks.filter((t) => t.status === "COMPLETED").length;
              const pct = taskTotal === 0 ? 0 : Math.round((taskDone / taskTotal) * 100);
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td>
                    <Link
                      href={`/permits/${p.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-[10px] tabular-nums text-muted-foreground">
                    {p.permitNumber ?? "—"}
                  </td>
                  <td className="text-[11px] text-muted-foreground">{p.authority.name}</td>
                  <td>
                    <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                      {PERMIT_STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded bg-muted">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                  </td>
                  <td className="text-[11px] tabular-nums">
                    {taskDone}/{taskTotal}
                  </td>
                  <td className="text-[11px] tabular-nums">{p._count.buildings}</td>
                  <td className="text-[11px] tabular-nums">{p._count.documents}</td>
                  <td>
                    <Link
                      href={`/permits/${p.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="פתח היתר"
                    >
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
