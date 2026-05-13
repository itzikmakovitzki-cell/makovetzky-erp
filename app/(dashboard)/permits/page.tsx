import Link from "next/link";
import { FolderPlus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
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

      <div className="rounded-md border bg-card">
        <table>
          <thead>
            <tr>
              <th>שם היתר</th>
              <th>מספר היתר</th>
              <th>לקוח</th>
              <th>רשות</th>
              <th className="w-28">סטטוס</th>
              <th className="w-36">התקדמות</th>
              <th className="w-20 text-center">משימות</th>
              <th className="w-20 text-center">בניינים</th>
              <th className="w-24">צפוי לסיום</th>
            </tr>
          </thead>
          <tbody>
            {permits.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
                  אין היתרים עדיין
                </td>
              </tr>
            )}
            {permits.map((p) => {
              const pct = completionByPermit.get(p.id) ?? 0;
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td>
                    <Link
                      href={`/permits/${p.id}/tasks`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="font-mono text-[11px] text-muted-foreground">
                    {p.permitNumber ?? "—"}
                  </td>
                  <td className="text-xs">
                    <Link
                      href={`/clients/${p.masterDeal.clientId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {p.masterDeal.client.companyName}
                    </Link>
                  </td>
                  <td className="text-xs">{p.authority.name}</td>
                  <td>
                    <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                      {PERMIT_STATUS_LABEL[p.status]}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className={cn(
                            "h-full",
                            pct === 100 ? "bg-emerald-500" : "bg-sky-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-9 text-end text-[11px] tabular-nums">{pct}%</span>
                    </div>
                  </td>
                  <td className="text-center text-xs tabular-nums">{p._count.tasks}</td>
                  <td className="text-center text-xs tabular-nums">{p._count.buildings}</td>
                  <td className="text-xs tabular-nums">{formatDate(p.expectedCloseDate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
