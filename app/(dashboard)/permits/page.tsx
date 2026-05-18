import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PermitMobileCard } from "@/components/permits/permit-mobile-card";
import { PermitRowActions } from "@/components/permits/permit-row-actions";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PermitsListPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const permits = await prisma.permit.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      authority: { select: { name: true } },
      masterDeal: { include: { client: { select: { companyName: true } } } },
      _count: {
        select: {
          tasks: { where: { deletedAt: null } },
          buildings: true
        }
      }
    }
  });

  // Compute completion % per permit
  const completionByPermit = new Map<string, number>();
  await Promise.all(
    permits.map(async (p) => {
      if (p._count.tasks === 0) {
        completionByPermit.set(p.id, 0);
        return;
      }
      const completed = await prisma.task.count({
        where: { permitId: p.id, status: "COMPLETED", deletedAt: null }
      });
      completionByPermit.set(p.id, Math.round((completed / p._count.tasks) * 100));
    })
  );

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-base font-semibold">היתרים ({permits.length})</h1>
        {isAdmin && (
          <Link
            href="/permits/new"
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            <FolderPlus className="size-3.5" />
            פרויקט חדש
          </Link>
        )}
      </div>

      <div className="md:hidden flex flex-col gap-2">
        {permits.length === 0 ? (
          <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
            אין היתרים עדיין
          </div>
        ) : (
          permits.map((p) => (
            <PermitMobileCard
              key={p.id}
              permit={p}
              completionPct={completionByPermit.get(p.id) ?? 0}
            />
          ))
        )}
      </div>

      <div className="hidden md:block overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
        <table className="table-loose table-sticky-head">
          <thead>
            <tr>
              <th>שם היתר</th>
              <th>מספר היתר</th>
              <th>לקוח</th>
              <th>רשות</th>
              <th className="w-32">סטטוס</th>
              <th className="w-44">התקדמות</th>
              <th className="w-24 text-center">משימות</th>
              <th className="w-24 text-center">בניינים</th>
              <th className="w-28">צפוי לסיום</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {permits.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                  אין היתרים עדיין
                </td>
              </tr>
            )}
            {permits.map((p) => {
              const pct = completionByPermit.get(p.id) ?? 0;
              return (
                <tr key={p.id} className="group hover:bg-muted/50">
                  <td>
                    <Link
                      href={`/permits/${p.id}/tasks`}
                      className="font-medium text-foreground underline-offset-2 transition-colors group-hover:text-foreground group-hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">
                    {p.permitNumber ?? "—"}
                  </td>
                  <td>
                    <Link
                      href={`/clients/${p.masterDeal.clientId}`}
                      className="text-foreground/90 underline-offset-2 transition-colors hover:text-foreground hover:underline"
                    >
                      {p.masterDeal.client.companyName}
                    </Link>
                  </td>
                  <td className="text-foreground/80">{p.authority.name}</td>
                  <td>
                    <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                      {PERMIT_STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            pct === 100 ? "bg-emerald-500" : "bg-sky-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-10 text-end text-xs font-medium tabular-nums text-foreground">
                        {pct}%
                      </span>
                    </div>
                  </td>
                  <td className="text-center tabular-nums">{p._count.tasks}</td>
                  <td className="text-center tabular-nums">{p._count.buildings}</td>
                  <td className="tabular-nums text-muted-foreground">
                    {formatDate(p.expectedCloseDate)}
                  </td>
                  <td className="p-1 text-center">
                    <PermitRowActions
                      permitId={p.id}
                      permitName={p.name}
                      status={p.status}
                      isAdmin={isAdmin}
                    />
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
