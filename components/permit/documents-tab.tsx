import { prisma } from "@/lib/prisma";
import {
  DocumentsTableInteractive,
  type DocumentRow
} from "@/components/permit/documents-table-interactive";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";

export async function DocumentsTab({ permitId }: { permitId: string }) {
  const [documents, tasks, buildings] = await Promise.all([
    prisma.document.findMany({
      where: { permitId },
      include: {
        task: { select: { id: true, name: true } },
        building: { select: { id: true, label: true } },
        uploadedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } }
      },
      orderBy: [{ isLatestApproved: "desc" }, { createdAt: "desc" }]
    }),
    prisma.task.findMany({
      where: { permitId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.building.findMany({
      where: { permitId },
      select: { id: true, label: true },
      orderBy: { label: "asc" }
    })
  ]);

  // Batch-fetch signed URLs for storage-path docs; legacy/mock https URLs pass through.
  const storagePaths = documents.map((d) => d.fileUrl).filter(isStoragePath);
  const signedUrls = await createSignedUrlsSafe(storagePaths);

  const serializedDocuments: DocumentRow[] = documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    version: d.version,
    isLatestApproved: d.isLatestApproved,
    taskId: d.taskId,
    taskName: d.task?.name ?? null,
    buildingId: d.buildingId,
    buildingLabel: d.building?.label ?? null,
    uploadedById: d.uploadedById,
    uploadedByName: d.uploadedBy?.name ?? null,
    approvedById: d.approvedById,
    approvedByName: d.approvedBy?.name ?? null,
    approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
    notes: d.notes,
    downloadUrl: isStoragePath(d.fileUrl)
      ? signedUrls.get(d.fileUrl) ?? null
      : d.fileUrl
  }));

  return (
    <DocumentsTableInteractive
      permitId={permitId}
      documents={serializedDocuments}
      tasks={tasks}
      buildings={buildings}
    />
  );
}
