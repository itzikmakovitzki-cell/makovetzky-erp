import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Building2, FileCheck2, Mail, MapPin, Phone, User } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ClientProfileActions } from "@/components/clients/client-profile-actions";
import { ClientWhatsAppPanel } from "@/components/clients/client-whatsapp-panel";
import { PortalAccessSection } from "@/components/clients/portal-access-section";
import {
  MASTER_DEAL_STATUS_LABEL,
  MASTER_DEAL_STATUS_VARIANT,
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatILS } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ClientProfilePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/permits");
  }

  const { id } = await params;

  const [client, contractorCandidates] = await Promise.all([
    prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        masterDeals: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            permits: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              include: {
                authority: { select: { name: true } },
                _count: {
                  select: {
                    tasks: { where: { deletedAt: null } },
                    buildings: true
                  }
                }
              }
            }
          }
        },
        portalAccesses: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    prisma.user.findMany({
      where: { role: "CONTRACTOR", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" }
    })
  ]);

  if (!client) notFound();

  const portalAccesses = client.portalAccesses.map((pa) => ({
    userId: pa.user.id,
    userName: pa.user.name,
    userEmail: pa.user.email,
    createdAt: pa.createdAt.toISOString()
  }));

  const allPermits = client.masterDeals.flatMap((d) => d.permits);
  const activePermits = allPermits.filter(
    (p) =>
      p.status === "DRAFT" ||
      p.status === "IN_PROGRESS" ||
      p.status === "AWAITING_AUTHORITY"
  );
  const totalContractValue = client.masterDeals.reduce(
    (sum, d) => sum + (d.totalValue ? Number(d.totalValue.toString()) : 0),
    0
  );

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
          >
            <ArrowRight className="size-3" />
            חזרה
          </Link>
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <Building2 className="size-4" />
              {client.companyName}
            </h1>
            {client.hp && (
              <p className="text-[11px] text-muted-foreground">
                ח.פ. <span className="font-mono tabular-nums">{client.hp}</span>
              </p>
            )}
          </div>
        </div>
        <ClientProfileActions
          client={{
            id: client.id,
            companyName: client.companyName,
            hp: client.hp ?? "",
            contactName: client.contactName,
            phone: client.phone,
            email: client.email ?? "",
            address: client.address ?? "",
            notes: client.notes ?? ""
          }}
          dealCount={client.masterDeals.length}
        />
      </header>

      {/* Contact / metrics row */}
      <div className="grid grid-cols-4 gap-3">
        <ProfileCard label="איש קשר" icon={<User className="size-3.5" />}>
          <div className="text-sm font-medium">{client.contactName}</div>
        </ProfileCard>
        <ProfileCard label="טלפון" icon={<Phone className="size-3.5" />}>
          <div className="text-sm font-medium tabular-nums">{client.phone}</div>
        </ProfileCard>
        <ProfileCard label="אימייל" icon={<Mail className="size-3.5" />}>
          <div className="truncate text-sm font-medium">
            {client.email ?? <span className="text-muted-foreground">—</span>}
          </div>
        </ProfileCard>
        <ProfileCard label="כתובת" icon={<MapPin className="size-3.5" />}>
          <div className="truncate text-sm font-medium" title={client.address ?? undefined}>
            {client.address ?? <span className="text-muted-foreground">—</span>}
          </div>
        </ProfileCard>
      </div>

      {/* Aggregate metrics */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="עסקאות" value={client.masterDeals.length} />
        <MetricCard label="היתרים — סה״כ" value={allPermits.length} />
        <MetricCard
          label="היתרים פעילים"
          value={activePermits.length}
          accent={activePermits.length > 0 ? "info" : undefined}
        />
        <MetricCard
          label="ערך עסקאות"
          value={formatILS(totalContractValue)}
        />
      </div>

      {client.notes && (
        <div className="rounded-md border bg-amber-50/40 px-3 py-2 text-[12px] dark:bg-amber-500/5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            הערות
          </div>
          <div className="mt-0.5 whitespace-pre-wrap">{client.notes}</div>
        </div>
      )}

      <ClientWhatsAppPanel
        clientId={client.id}
        clientName={client.companyName}
        clientPhone={client.phone}
        initialPreference={client.notificationPreference}
      />

      <PortalAccessSection
        clientId={client.id}
        accesses={portalAccesses}
        contractorCandidates={contractorCandidates}
      />

      {/* Deals + Permits */}
      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            עסקאות והיתרים ({client.masterDeals.length})
          </h2>
        </div>

        {client.masterDeals.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            ללקוח אין עסקאות עדיין. צור פרויקט חדש מהדף{" "}
            <Link href="/permits/new" className="underline">היתרים</Link>.
          </div>
        ) : (
          <div className="divide-y">
            {client.masterDeals.map((deal) => (
              <div key={deal.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{deal.name}</h3>
                      <Badge variant={MASTER_DEAL_STATUS_VARIANT[deal.status]}>
                        {MASTER_DEAL_STATUS_LABEL[deal.status]}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {deal.totalValue && (
                        <span>
                          ערך:{" "}
                          <span className="text-foreground tabular-nums">
                            {formatILS(deal.totalValue)}
                          </span>
                        </span>
                      )}
                      {deal.contractDate && (
                        <span>
                          תאריך חוזה:{" "}
                          <span className="text-foreground">
                            {formatDate(deal.contractDate)}
                          </span>
                        </span>
                      )}
                      <span>
                        היתרים:{" "}
                        <span className="text-foreground tabular-nums">
                          {deal.permits.length}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {deal.permits.length > 0 && (
                  <table className="mt-2">
                    <thead>
                      <tr>
                        <th>היתר</th>
                        <th className="w-28">מספר</th>
                        <th className="w-32">רשות</th>
                        <th className="w-28">סטטוס</th>
                        <th className="w-20 text-center">משימות</th>
                        <th className="w-20 text-center">בניינים</th>
                        <th className="w-24">צפוי לסיום</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deal.permits.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td>
                            <Link
                              href={`/permits/${p.id}/tasks`}
                              className="inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline"
                            >
                              <FileCheck2 className="size-3 text-muted-foreground" />
                              {p.name}
                            </Link>
                          </td>
                          <td className="font-mono text-[11px] text-muted-foreground">
                            {p.permitNumber ?? "—"}
                          </td>
                          <td className="text-xs">{p.authority.name}</td>
                          <td>
                            <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                              {PERMIT_STATUS_LABEL[p.status]}
                            </Badge>
                          </td>
                          <td className="text-center text-xs tabular-nums">
                            {p._count.tasks}
                          </td>
                          <td className="text-center text-xs tabular-nums">
                            {p._count.buildings}
                          </td>
                          <td className="text-xs tabular-nums">
                            {formatDate(p.expectedCloseDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ProfileCard({
  label,
  icon,
  children
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border bg-card px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent
}: {
  label: string;
  value: string | number;
  accent?: "info";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card px-3 py-2",
        accent === "info" && "border-sky-500/40 bg-sky-500/5"
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
