import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ProjectWhatsAppPanel } from "@/components/projects/project-whatsapp-panel";
import {
  ProjectWhatsAppTimeline,
  type TimelineRow
} from "@/components/projects/project-whatsapp-timeline";
import { listOrphanWhatsAppGroups } from "@/app/actions/whatsapp-groups";

export const dynamic = "force-dynamic";

// Spec: docs/spec-whatsapp-groups.md §6. Sections A + B from PR-2; the
// integrated incoming/outgoing timeline (Section C) lands in PR-3.

const TIMELINE_PAGE_SIZE = 50;

export default async function ProjectWhatsAppPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * TIMELINE_PAGE_SIZE;

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
            captureAllFiles: true,
            connectedBy: { select: { name: true } }
          }
        }
      }
    }),
    listOrphanWhatsAppGroups()
  ]);

  if (!deal) notFound();

  const groupChatId = deal.whatsappGroup?.groupChatId ?? null;

  // Section C: merged inbound (PendingDocument scoped to the group) +
  // outbound (AuditLog of whatsapp_group_* events on this deal).
  // We over-fetch and merge in memory because Prisma can't UNION two model
  // queries; the page size is the cap so the working set stays small.
  const [pendingDocs, auditRows, pendingCount, auditCount] = await Promise.all([
    groupChatId
      ? prisma.pendingDocument.findMany({
          where: { groupChatId },
          orderBy: { createdAt: "desc" },
          take: TIMELINE_PAGE_SIZE + skip,
          select: {
            id: true,
            createdAt: true,
            authorName: true,
            authorPhone: true,
            senderInfo: true,
            rawMessage: true,
            fileName: true,
            mimeType: true,
            suggestedTaskName: true,
            status: true,
            fileUrl: true,
            assignedPermitId: true,
            assignedTaskId: true,
            assignedPermit: { select: { name: true } },
            assignedTask: { select: { name: true } }
          }
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: {
        entityType: "MASTER_DEAL",
        entityId: deal.id,
        // Filter to whatsapp_group_* events via JSONB path on newValue->>event.
        // Prisma exposes string_contains for JsonNullable<string>; we use a
        // raw path read since we want exact match on the prefix.
        newValue: { path: ["event"], string_starts_with: "whatsapp_group_" }
      },
      orderBy: { timestamp: "desc" },
      take: TIMELINE_PAGE_SIZE + skip,
      select: {
        id: true,
        timestamp: true,
        newValue: true,
        user: { select: { name: true } }
      }
    }),
    groupChatId
      ? prisma.pendingDocument.count({ where: { groupChatId } })
      : Promise.resolve(0),
    prisma.auditLog.count({
      where: {
        entityType: "MASTER_DEAL",
        entityId: deal.id,
        newValue: { path: ["event"], string_starts_with: "whatsapp_group_" }
      }
    })
  ]);

  // Helpers — narrow JSON fields safely. AuditLog.newValue is Prisma.JsonValue;
  // we keep the destructuring defensive so a malformed/legacy row never blows
  // up the page render.
  function readString(obj: unknown, key: string): string | null {
    if (typeof obj !== "object" || obj === null) return null;
    const v = (obj as Record<string, unknown>)[key];
    return typeof v === "string" ? v : null;
  }
  function readBoolEvent(obj: unknown, ok: string, fail: string): boolean {
    const ev = readString(obj, "event");
    if (ev === ok) return true;
    if (ev === fail) return false;
    return true; // legacy or unknown — treat as ok
  }

  // Drill-down target for an incoming row:
  //   PENDING  → /inbox (no per-row anchor today, but lands on the workspace)
  //   ASSIGNED → /permits/<permitId>/tasks if we know the permit, otherwise /inbox
  //   REJECTED → /inbox?all=true so the row is visible under the "all" filter
  const incomingHref = (p: {
    status: "PENDING" | "ASSIGNED" | "REJECTED";
    assignedPermitId: string | null;
  }): string => {
    if (p.status === "ASSIGNED" && p.assignedPermitId) {
      return `/permits/${p.assignedPermitId}/tasks`;
    }
    if (p.status === "REJECTED") return "/inbox?all=true";
    return "/inbox";
  };

  // Outgoing rows go to the audit log filtered to this deal's WhatsApp
  // events. The audit log page accepts entityType (alias for entity) +
  // entityId as deep-link drill-down params and shows a "מסונן לפי ישות"
  // chip with a clear button when entityId is present.
  const outgoingHref = `/settings/audit-log?entityType=MASTER_DEAL&entityId=${deal.id}`;

  const inboundRows: TimelineRow[] = pendingDocs.map((p) => {
    const isMedia = !!p.fileUrl && p.fileUrl !== "";
    const href = incomingHref(p);
    if (isMedia) {
      return {
        kind: "incoming-media",
        direction: "incoming",
        id: p.id,
        at: p.createdAt.toISOString(),
        authorName: p.authorName ?? p.senderInfo,
        authorPhone: p.authorPhone,
        fileName: p.fileName,
        mimeType: p.mimeType,
        caption: p.rawMessage,
        suggestedTaskName: p.suggestedTaskName,
        status: p.status,
        assignedPermitName: p.assignedPermit?.name ?? null,
        assignedTaskName: p.assignedTask?.name ?? null,
        href
      } satisfies TimelineRow;
    }
    return {
      kind: "incoming-text",
      direction: "incoming",
      id: p.id,
      at: p.createdAt.toISOString(),
      authorName: p.authorName ?? p.senderInfo,
      authorPhone: p.authorPhone,
      text: p.rawMessage,
      suggestedTaskName: p.suggestedTaskName,
      status: p.status,
      assignedPermitName: p.assignedPermit?.name ?? null,
      assignedTaskName: p.assignedTask?.name ?? null,
      href
    } satisfies TimelineRow;
  });

  const outboundRows: TimelineRow[] = auditRows.map((a) => {
    const ok = readBoolEvent(
      a.newValue,
      "whatsapp_group_sent",
      "whatsapp_group_send_failed"
    );
    return {
      kind: "outgoing-text",
      direction: "outgoing",
      id: a.id,
      at: a.timestamp.toISOString(),
      actorName: a.user?.name ?? null,
      text: readString(a.newValue, "message") ?? "",
      idMessage: readString(a.newValue, "idMessage"),
      ok,
      error: readString(a.newValue, "error"),
      href: outgoingHref
    } satisfies TimelineRow;
  });

  const merged = [...inboundRows, ...outboundRows].sort(
    (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)
  );
  const pageRows = merged.slice(skip, skip + TIMELINE_PAGE_SIZE);
  const totalCount = pendingCount + auditCount;

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
                connectedByName: deal.whatsappGroup.connectedBy?.name ?? null,
                captureAllFiles: deal.whatsappGroup.captureAllFiles
              }
            : null
        }
        orphanGroups={orphanGroups}
        clientNotificationPreference={deal.client.notificationPreference}
      />

      <ProjectWhatsAppTimeline
        rows={pageRows}
        page={page}
        pageSize={TIMELINE_PAGE_SIZE}
        totalCount={totalCount}
        basePath={`/projects/${deal.id}/whatsapp`}
      />
    </section>
  );
}
