import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProjectWhatsAppPanel } from "@/components/projects/project-whatsapp-panel";
import { listOrphanWhatsAppGroups } from "@/app/actions/whatsapp-groups";

export const dynamic = "force-dynamic";

// Spec: docs/spec-whatsapp-groups.md §6 (PR-2). Sections A + B only — the
// integrated incoming/outgoing timeline (Section C) ships with PR-3.

export default async function ProjectWhatsAppPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    // WhatsApp send + group wiring is admin-only; non-admins shouldn't even
    // see the page chrome.
    redirect(`/projects/${id}`);
  }

  const [deal, orphanGroups] = await Promise.all([
    prisma.masterDeal.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        name: true,
        whatsappDefaultRoute: true,
        client: {
          select: {
            id: true,
            companyName: true,
            notificationPreference: true
          }
        },
        whatsappGroup: {
          select: {
            id: true,
            groupChatId: true,
            groupName: true,
            connectedAt: true,
            isActive: true,
            connectedBy: { select: { name: true } }
          }
        }
      }
    }),
    listOrphanWhatsAppGroups()
  ]);

  if (!deal) notFound();

  return (
    <section className="flex flex-col gap-3">
      <div>
        <Link
          href={`/projects/${deal.id}`}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לפרויקט
        </Link>
      </div>

      <header className="rounded-md border bg-card p-3">
        <h1 className="inline-flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="size-4 text-emerald-600" />
          WhatsApp — {deal.name}
        </h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          ניהול הקבוצה של הפרויקט ב-WhatsApp ושליחת עדכון לכל חברי הקבוצה.
          לקוח: <span className="font-medium">{deal.client.companyName}</span>
        </p>
      </header>

      <ProjectWhatsAppPanel
        masterDealId={deal.id}
        dealName={deal.name}
        defaultRoute={deal.whatsappDefaultRoute}
        connectedGroup={
          deal.whatsappGroup
            ? {
                id: deal.whatsappGroup.id,
                groupChatId: deal.whatsappGroup.groupChatId,
                groupName: deal.whatsappGroup.groupName,
                connectedAt: deal.whatsappGroup.connectedAt,
                isActive: deal.whatsappGroup.isActive,
                connectedByName: deal.whatsappGroup.connectedBy?.name ?? null
              }
            : null
        }
        orphanGroups={orphanGroups}
        clientNotificationPreference={deal.client.notificationPreference}
      />

      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-[10.5px] text-muted-foreground">
        📋 היסטוריית התכתבות (נכנס + יוצא) תתווסף ב-PR-3 יחד עם ניתוח
        תיוגים אוטומטי של קבצים שמתויגים לקבוצה.
      </div>
    </section>
  );
}
