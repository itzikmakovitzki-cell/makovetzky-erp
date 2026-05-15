import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, CheckCircle2, ExternalLink } from "lucide-react";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";

export async function DocumentsSummary({ permitId }: { permitId: string }) {
  const documents = await prisma.document.findMany({
    where: { permitId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      building: { select: { label: true } },
      task: { select: { name: true } }
    }
  });

  const approvedCount = documents.filter((d) => d.isLatestApproved).length;

  // Sign storage paths in one batch so each file name renders as a clickable
  // link. External URLs (legacy data) pass through verbatim.
  const storagePaths = documents.map((d) => d.fileUrl).filter(isStoragePath);
  const signedUrls = await createSignedUrlsSafe(storagePaths);
  const previewUrlFor = (fileUrl: string): string | null => {
    if (!fileUrl) return null;
    if (isStoragePath(fileUrl)) return signedUrls.get(fileUrl) ?? null;
    return fileUrl;
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1 text-center">
        <Stat label='סה"כ אחרונים' value={String(documents.length)} />
        <Stat label="גרסאות מאושרות" value={String(approvedCount)} />
      </div>

      <div className="rounded border">
        <div className="border-b bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          רשימה
        </div>
        <ul className="divide-y">
          {documents.length === 0 && (
            <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">
              אין מסמכים עדיין
            </li>
          )}
          {documents.map((d) => {
            const url = previewUrlFor(d.fileUrl);
            return (
            <li key={d.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 text-[12px] font-medium underline-offset-2 hover:underline"
                      title="פתח קובץ"
                    >
                      <span className="truncate">{d.fileName}</span>
                      <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
                    </a>
                  ) : (
                    <span className="truncate text-[12px] font-medium">{d.fileName}</span>
                  )}
                  {d.isLatestApproved && (
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-600" />
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>v{d.version}</span>
                  {d.building && <span>· {d.building.label}</span>}
                  {d.task && <span>· {d.task.name}</span>}
                  <span>· {formatDate(d.createdAt)}</span>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card px-1.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[12px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}
