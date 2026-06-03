"use client";

import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Send,
  XCircle
} from "lucide-react";
import type { PendingDocumentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn, formatDateTime } from "@/lib/utils";
import type { PendingDocRow } from "./inbox-table";

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

export function PendingDocMobileCard({
  doc,
  isRejecting,
  onAssign,
  onReject
}: {
  doc: PendingDocRow;
  isRejecting: boolean;
  onAssign: (id: string) => void;
  onReject: (doc: PendingDocRow) => void;
}) {
  const isPending = doc.status === "PENDING";

  return (
    <Card className={cn(!isPending && "opacity-75")}>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
            {doc.previewUrl ? (
              <a
                href={doc.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-medium underline-offset-2 hover:underline"
                title="פתח קובץ"
              >
                {doc.fileName ?? "ללא שם"}
                <ExternalLink className="ms-1 inline size-2.5 text-muted-foreground" />
              </a>
            ) : (
              <span className="line-clamp-2 text-sm font-medium">
                {doc.fileName ?? "ללא שם"}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {doc.sourceChannel} · {formatDateTime(doc.createdAt)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[doc.status]}>{STATUS_LABEL[doc.status]}</Badge>
      </CardHeader>

      <CardContent className="text-[11px]">
        {doc.senderInfo && <div className="text-foreground">{doc.senderInfo}</div>}
        {doc.rawMessage && (
          <div className="italic text-muted-foreground line-clamp-2">
            &ldquo;{doc.rawMessage}&rdquo;
          </div>
        )}
        {doc.status === "ASSIGNED" && doc.assignedPermitId && (
          <div className="text-muted-foreground">
            שויך לתיק:{" "}
            <Link
              href={`/permits/${doc.assignedPermitId}/documents`}
              className="text-foreground underline-offset-2 hover:underline"
            >
              {doc.assignedPermitName}
            </Link>
            {doc.assignedTaskName && (
              <span> · {doc.assignedTaskName}</span>
            )}
          </div>
        )}
        {doc.status === "REJECTED" && doc.rejectionReason && (
          <div className="text-muted-foreground">
            סיבת דחייה: {doc.rejectionReason}
          </div>
        )}
      </CardContent>

      <CardFooter>
        {isPending ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onAssign(doc.id)}
              disabled={isRejecting}
              className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              <Send className="size-3" /> שייך
            </button>
            <button
              type="button"
              onClick={() => onReject(doc)}
              disabled={isRejecting}
              className="inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
            >
              {isRejecting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <XCircle className="size-3" />
              )}
              דחה
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <CheckCircle2 className="size-3" />
            {doc.processedAt
              ? `טופל ${formatDateTime(doc.processedAt)}`
              : "טופל"}
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
