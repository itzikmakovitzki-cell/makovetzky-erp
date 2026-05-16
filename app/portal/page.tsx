import Link from "next/link";
import { ArrowLeft, Building2, Inbox, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { getPortalScope, permitClientFilter } from "@/lib/portal-access";

export const dynamic = "force-dynamic";

export default async function PortalDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = { id: session.user.id, role: session.user.role };
  const scope = await getPortalScope(user);

  // Empty-state for newly-onboarded users (no PortalAccess rows yet).
  const noAccess = scope.kind === "scoped" && scope.clientIds.length === 0;

  const permits = noAccess
    ? []
    : await prisma.permit.findMany({
        where: {
          deletedAt: null,
          ...permitClientFilter(scope)
        },
        include: {
          masterDeal: { select: { id: true, name: true, client: { select: { id: true, companyName: true } } } },
          authority: { select: { id: true, name: true } },
          _count: {
            select: {
              tasks: { where: { deletedAt: null } },
              buildings: true
            }
          }
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
      });

  // For each permit, count completed tasks so we can render a progress bar
  // without dragging all the task rows into the dashboard payload.
  const permitIds = permits.map((p) => p.id);
  const completedCounts = permitIds.length === 0
    ? new Map<string, number>()
    : new Map(
        (
          await prisma.task.groupBy({
            by: ["permitId"],
            where: { permitId: { in: permitIds }, deletedAt: null, status: "COMPLETED" },
            _count: { _all: true }
          })
        ).map((row) => [row.permitId, row._count._all])
      );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-base font-semibold sm:text-lg">שלום, {session.user.name}</h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {noAccess
            ? "עוד לא הוקצתה לך גישה לפרויקטים. צוות מקובצקי יחבר אותך בקרוב."
            : `${permits.length} ${permits.length === 1 ? "היתר זמין" : "היתרים זמינים"} לצפייה.`}
        </p>
      </header>

      {noAccess && (
        <div className="rounded-md border bg-card p-6 text-center">
          <Inbox className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-2 text-[13px] text-muted-foreground">
            אם אתה חושב שזו טעות — בקש מצוות מקובצקי לקשר את החשבון שלך לחברה הרלוונטית.
          </p>
        </div>
      )}

      {!noAccess && permits.length === 0 && (
        <div className="rounded-md border bg-card p-6 text-center text-[13px] text-muted-foreground">
          אין כרגע היתרים פעילים תחת החברה שלך.
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {permits.map((p) => {
          const completed = completedCounts.get(p.id) ?? 0;
          const total = p._count.tasks;
          const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
          const isLocked = p.status === "COMPLETED";
          return (
            <li key={p.id}>
              <Link
                href={`/portal/permit/${p.id}`}
                className="block rounded-md border bg-card p-3 transition-colors hover:border-foreground/40 sm:p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold sm:text-[15px]">{p.name}</div>
                    {p.permitNumber && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        מספר היתר · {p.permitNumber}
                      </div>
                    )}
                  </div>
                  <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>{PERMIT_STATUS_LABEL[p.status]}</Badge>
                </div>

                <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
                  <dt className="text-muted-foreground">לקוח</dt>
                  <dd className="truncate text-end">{p.masterDeal.client.companyName}</dd>
                  <dt className="text-muted-foreground">פרויקט</dt>
                  <dd className="truncate text-end">{p.masterDeal.name}</dd>
                  <dt className="text-muted-foreground">רשות</dt>
                  <dd className="truncate text-end">{p.authority.name}</dd>
                  <dt className="text-muted-foreground">בניינים</dt>
                  <dd className="text-end tabular-nums">{p._count.buildings}</dd>
                </dl>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>התקדמות משימות</span>
                    <span className="tabular-nums">
                      {completed}/{total} · {percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                  {isLocked && (
                    <span className="me-auto inline-flex items-center gap-1 text-[10px]">
                      <Lock className="size-2.5" />
                      היתר סגור — צפייה בלבד
                    </span>
                  )}
                  <span>פתח</span>
                  <ArrowLeft className="size-3" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {!noAccess && scope.kind === "admin" && (
        <div className="rounded border border-dashed border-input bg-muted/30 px-3 py-2 text-[10px] text-muted-foreground">
          <Building2 className="me-1 inline-block size-3 align-text-bottom" />
          אתה רואה את כל ההיתרים במערכת כי אתה מחובר כאדמין. קבלנים יראו רק את ההיתרים של החברה שלהם.
        </div>
      )}
    </div>
  );
}
