"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, formatFileSize } from "@/lib/utils";
import { ApproveDocumentButton } from "./approve-document-button";
import { UploadDocumentDialog } from "./upload-document-dialog";

export type DocumentRow = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  version: number;
  isLatestApproved: boolean;
  taskId: string | null;
  taskName: string | null;
  buildingId: string | null;
  buildingLabel: string | null;
  uploadedById: string | null;
  uploadedByName: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  createdAt: string;
  notes: string | null;
  downloadUrl: string | null;
};

export function DocumentsTableInteractive({
  permitId,
  documents,
  tasks,
  buildings
}: {
  permitId: string;
  documents: DocumentRow[];
  tasks: { id: string; name: string }[];
  buildings: { id: string; label: string }[];
}) {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          מסמכים ({documents.length})
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-emerald-500 text-emerald-600" />
            הגרסה האחרונה המאושרת
          </span>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-3" />
            העלה מסמך
          </button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>שם קובץ</th>
            <th className="w-16 text-center">גרסה</th>
            <th>משימה משויכת</th>
            <th className="w-32">הועלה ע״י</th>
            <th className="w-32">אושר ע״י</th>
            <th className="w-28">תאריך העלאה</th>
            <th className="w-24">סטטוס</th>
            <th className="w-20">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 && (
            <tr>
              <td colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                אין מסמכים בהיתר זה עדיין. לחץ "+ העלה מסמך" כדי להעלות את הראשון.
              </td>
            </tr>
          )}
          {documents.map((d) => (
            <DocumentRowComponent key={d.id} document={d} />
          ))}
        </tbody>
      </table>

      {uploadOpen && (
        <UploadDocumentDialog
          permitId={permitId}
          tasks={tasks}
          buildings={buildings}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  );
}

function DocumentRowComponent({ document: d }: { document: DocumentRow }) {
  const isPending = d.approvedById === null;
  const isLatest = d.isLatestApproved;
  const isSuperseded = !isPending && !isLatest;

  return (
    <tr
      className={cn(
        "hover:bg-muted/30",
        isLatest && "bg-emerald-50/40 dark:bg-emerald-500/5",
        isSuperseded && "text-muted-foreground"
      )}
    >
      <td>
        <div className="flex items-center gap-1.5">
          {isLatest && (
            <Star
              className="size-3 shrink-0 fill-emerald-500 text-emerald-600"
              aria-label="גרסה אחרונה מאושרת"
            />
          )}
          <FileText className="size-3 shrink-0 text-muted-foreground" />
          {d.downloadUrl ? (
            <a
              href={d.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "font-medium underline-offset-2 hover:underline",
                isSuperseded && "line-through"
              )}
              title="הורד / פתח בטאב חדש"
            >
              {d.fileName}
            </a>
          ) : (
            <span className={cn("font-medium", isSuperseded && "line-through")}>
              {d.fileName}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
          {d.buildingLabel && <span>📍 {d.buildingLabel}</span>}
          {d.mimeType && <span>{d.mimeType}</span>}
          {d.sizeBytes !== null && <span>{formatFileSize(d.sizeBytes)}</span>}
          {d.notes && <span className="italic">· {d.notes}</span>}
        </div>
      </td>
      <td className="text-center font-mono text-[11px] tabular-nums">v{d.version}</td>
      <td className="text-xs">
        {d.taskName ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="text-xs">
        {d.uploadedByName ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="text-xs">
        {d.approvedByName ? (
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="size-3 text-emerald-600" />
            {d.approvedByName}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-[11px] tabular-nums text-muted-foreground">
        {formatDateTime(d.createdAt)}
      </td>
      <td>
        {isPending ? (
          <Badge variant="warning">ממתין</Badge>
        ) : isLatest ? (
          <Badge variant="success">מאושר · אחרון</Badge>
        ) : (
          <Badge variant="muted">מאושר · גרסה ישנה</Badge>
        )}
      </td>
      <td>{isPending && <ApproveDocumentButton documentId={d.id} />}</td>
    </tr>
  );
}
