import { prisma } from "@/lib/prisma";
import { InboxTable, type PendingDocRow } from "@/components/inbox/inbox-table";
import {
  OrphanGroupsSection,
  type OrphanGroupRow
} from "@/components/inbox/orphan-groups-section";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const showAll = params.all === "true";

  const [pendingDocsRaw, deals, permits, tasks, buildings, orphanGroupsRaw] =
    await Promise.all([
      prisma.pendingDocument.findMany({
        where: showAll ? {} : { status: "PENDING" },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          assignedPermit: { select: { id: true, name: true } },
          assignedTask: { select: { id: true, name: true } }
        }
      }),
      prisma.masterDeal.findMany({
        select: { id: true, name: true },
        where: { status: { in: ["ACTIVE", "ON_HOLD"] }, deletedAt: null },
        orderBy: { name: "asc" }
      }),
      prisma.permit.findMany({
        where: { deletedAt: null },
        select: { id: true, masterDealId: true, name: true, permitNumber: true },
        orderBy: { name: "asc" }
      }),
      prisma.task.findMany({
        where: { deletedAt: null },
        select: { id: true, permitId: true, name: true },
        orderBy: { createdAt: "asc" }
      }),
      prisma.building.findMany({
        select: { id: true, permitId: true, label: true },
        orderBy: { label: "asc" }
      }),
      prisma.projectWhatsAppGroup.findMany({
        where: { masterDealId: null },
        select: { id: true, groupChatId: true, groupName: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

  const orphanGroups: OrphanGroupRow[] = orphanGroupsRaw.map((g) => ({
    id: g.id,
    groupChatId: g.groupChatId,
    groupName: g.groupName,
    createdAt: g.createdAt.toISOString()
  }));

  const storagePaths = pendingDocsRaw
    .map((d) => d.fileUrl)
    .filter(isStoragePath);
  const signedUrls = await createSignedUrlsSafe(storagePaths);

  const pendingDocs: PendingDocRow[] = pendingDocsRaw.map((p) => ({
    id: p.id,
    fileName: p.fileName,
    mimeType: p.mimeType,
    sourceChannel: p.sourceChannel,
    senderInfo: p.senderInfo,
    rawMessage: p.rawMessage,
    status: p.status,
    rejectionReason: p.rejectionReason,
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    assignedPermitId: p.assignedPermitId,
    assignedPermitName: p.assignedPermit?.name ?? null,
    assignedTaskId: p.assignedTaskId,
    assignedTaskName: p.assignedTask?.name ?? null,
    previewUrl: isStoragePath(p.fileUrl)
      ? signedUrls.get(p.fileUrl) ?? null
      : p.fileUrl
  }));

  return (
    <div className="flex flex-col gap-3">
      <OrphanGroupsSection orphans={orphanGroups} deals={deals} />
      <InboxTable
        pendingDocs={pendingDocs}
        deals={deals}
        permits={permits}
        tasks={tasks}
        buildings={buildings}
        showAll={showAll}
      />
    </div>
  );
}
