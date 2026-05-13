import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, CheckCircle2 } from "lucide-react";

export async function DocumentsSummary({ permitId }: { permitId: string }) {
  const documents = await prisma.document.findMany({
    where: { permitId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      building: { select: { label: true } },
      task: { select: { name: true } }
    }
  });

  const approvedCount = documents.filter((d) => d.isLatestApproved).length;

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
          {documents.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-[12px] font-medium">{d.fileName}</span>
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
          ))}
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
