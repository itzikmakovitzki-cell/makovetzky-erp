"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Send,
  Upload,
  XCircle,
  ExternalLink,
  Inbox as InboxIcon
} from "lucide-react";
import type { PendingDocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { rejectPendingDocument } from "@/app/actions/inbox";
import {
  ProcessPendingDialog,
  type PendingDocForDialog
} from "./process-pending-dialog";
import { ManualUploadDialog } from "./manual-upload-dialog";

export type PendingDocRow = PendingDocForDialog & {
  mimeType: string | null;
  status: PendingDocumentStatus;
  rejectionReason: string | null;
  processedAt: string | null;
  assignedPermitId: string | null;
  assignedPermitName: string | null;
  assignedTaskId: string | null;
  assignedTaskName: string | null;
};

const STATUS_LABEL: Record<PendingDocumentStatus, string> = {
  PENDING: "ממתין",
  ASSIGNED: "שויך",
  REJECTED: "נדחה"
};

const STATUS_VARIANT: Record<
  PendingDocumentStatus,
  "warning" | "success" | "destructive"
> = {
  PENDING: "warning",
  ASSIGNED: "success",
  REJECTED: "destructive"
};

export function InboxTable({
  pendingDocs,
  deals,
  permits,
  tasks,
  buildings,
  showAll
}: {
  pendingDocs: PendingDocRow[];
  deals: { id: string; name: string }[];
  permits: { id: string; masterDealId: string; name: string; permitNumber: string | null }[];
  tasks: { id: string; permitId: string; name: string }[];
  buildings: { id: string; permitId: string; label: string }[];
  showAll: boolean;
}) {
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectPending, startRejectTransition] = useTransition();
  const [manualUploadOpen, setManualUploadOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const processingDoc =
    processingDocId !== null
      ? pendingDocs.find((d) => d.id === processingDocId) ?? null
      : null;

  const onToggleShowAll = (checked: boolean) => {
    const next = new URLSearchParams(searchParams.toString());
    if (checked) next.set("all", "true");
    else next.delete("all");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleReject = (doc: PendingDocRow) => {
    const reason = window.prompt(
      `סיבת דחייה ל-"${doc.fileName ?? "המסמך"}":\n\n` +
        "הטקסט הזה יישלח למי ששלח את הקובץ (בהמשך, כשהבוט יחובר)."
    );
    if (!reason || !reason.trim()) return;
    setRejectingId(doc.id);
    startRejectTransition(async () => {
      try {
        await rejectPendingDocument(doc.id, reason);
      } finally {
        setRejectingId(null);
      }
    });
  };

  const pendingCount = pendingDocs.filter((d) => d.status === "PENDING").length;

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="inline-flex items-center gap-2 text-base font-semibold">
            <InboxIcon className="size-5 text-muted-foreground" />
            תיבת WhatsApp — מסמכים נכנסים
          </h1>
          <p className="text-[11px] text-muted-foreground">
            תיקיית כניסה ל-Triage. שייך מסמך לתיק/משימה או דחה עם סיבה.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => onToggleShowAll(e.target.checked)}
              className="size-3.5"
            />
            הצג גם מסמכים שטופלו (שויכו / נדחו)
          </label>
          <button
            type="button"
            onClick={() => setManualUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90"
          >
            <Upload className="size-3" />
            העלה מסמך
          </button>
        </div>
      </header>

      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {showAll
              ? `כל המסמכים הנכנסים (${pendingDocs.length})`
              : `ממתינים לטיפול (${pendingCount})`}
          </h2>
        </div>

        <table>
          <thead>
            <tr>
              <th>קובץ</th>
              <th className="w-24">מקור</th>
              <th>שולח / הודעה</th>
              <th className="w-32">התקבל</th>
              <th className="w-24">סטטוס</th>
              <th>שיוך</th>
              <th className="w-40">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {pendingDocs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                  {showAll ? "אין מסמכים נכנסים" : "אין מסמכים ממתינים לטיפול 🎉"}
                </td>
              </tr>
            )}
            {pendingDocs.map((d) => {
              const isPending = d.status === "PENDING";
              const isRejecting = rejectingId === d.id && rejectPending;
              return (
                <tr
                  key={d.id}
                  className={cn(
                    "hover:bg-muted/30",
                    !isPending && "text-muted-foreground"
                  )}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      <FileText className="size-3 shrink-0 text-muted-foreground" />
                      {d.previewUrl ? (
                        <a
                          href={d.previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium underline-offset-2 hover:underline"
                          title="פתח קובץ"
                        >
                          {d.fileName ?? "ללא שם"}
                        </a>
                      ) : (
                        <span className="font-medium">{d.fileName ?? "ללא שם"}</span>
                      )}
                      {d.previewUrl && (
                        <ExternalLink className="size-2.5 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="text-xs">{d.sourceChannel}</td>
                  <td className="text-[11px]">
                    {d.senderInfo && <div>{d.senderInfo}</div>}
                    {d.rawMessage && (
                      <div className="italic text-muted-foreground line-clamp-1">
                        &ldquo;{d.rawMessage}&rdquo;
                      </div>
                    )}
                  </td>
                  <td className="text-[11px] tabular-nums text-muted-foreground">
                    {formatDateTime(d.createdAt)}
                  </td>
                  <td>
                    <Badge variant={STATUS_VARIANT[d.status]}>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </td>
                  <td className="text-[11px]">
                    {d.status === "ASSIGNED" && d.assignedPermitId ? (
                      <span>
                        <Link
                          href={`/permits/${d.assignedPermitId}/documents`}
                          className="underline-offset-2 hover:underline"
                        >
                          {d.assignedPermitName}
                        </Link>
                        {d.assignedTaskName && (
                          <span className="text-muted-foreground"> · {d.assignedTaskName}</span>
                        )}
                      </span>
                    ) : d.status === "REJECTED" && d.rejectionReason ? (
                      <span className="text-muted-foreground" title={d.rejectionReason}>
                        סיבה: {d.rejectionReason}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    {isPending ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setProcessingDocId(d.id)}
                          disabled={isRejecting}
                          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background hover:opacity-90 disabled:opacity-50"
                        >
                          <Send className="size-2.5" /> שייך
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(d)}
                          disabled={isRejecting}
                          className="inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
                        >
                          {isRejecting ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <XCircle className="size-2.5" />
                          )}
                          דחה
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="size-3" />
                        {d.processedAt
                          ? `טופל ${formatDateTime(d.processedAt)}`
                          : "טופל"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {processingDoc && (
        <ProcessPendingDialog
          key={processingDoc.id}
          pendingDoc={processingDoc}
          deals={deals}
          permits={permits}
          tasks={tasks}
          buildings={buildings}
          onClose={() => setProcessingDocId(null)}
        />
      )}

      {manualUploadOpen && (
        <ManualUploadDialog onClose={() => setManualUploadOpen(false)} />
      )}
    </section>
  );
}
