import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  MessageCircle,
  Paperclip,
  XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

// Spec: docs/spec-whatsapp-groups.md §6.3 (PR-3).
// Merged inbound + outbound history for a single project's WhatsApp group.
// Server component — pure presentation over an already-merged + sorted list
// passed by the page (the page does the joins).
//
// Inbound rows come from PendingDocument scoped to the group's chatId; the
// status badge surfaces "תויג למשימה/היתר" once an admin has wired the file.
// Outbound rows come from AuditLog: every server-side group send writes an
// `event = whatsapp_group_*` newValue (see sendProjectGroupMessage in
// app/actions/whatsapp-groups.ts), so the timeline is reconstructible from
// the existing immutable audit table without a dedicated outbound table.

export type TimelineDirection = "incoming" | "outgoing";

// Each row carries an `href` so the timeline can render a click target
// without re-deriving the URL itself. The page computes:
//   • outgoing → /settings/audit-log filtered to MASTER_DEAL+dealId so the
//     admin lands on the row of the AuditLog entry that generated this
//     timeline item.
//   • incoming ASSIGNED → /permits/<permitId>/tasks when the doc was wired
//     to a permit (drills into the same view the admin used to file it).
//   • incoming PENDING → /inbox (no per-row anchor in /inbox today, but at
//     least the admin lands on the workspace where the row lives).
export type TimelineRow =
  | {
      kind: "incoming-text";
      direction: "incoming";
      id: string;
      at: string; // ISO
      authorName: string | null;
      authorPhone: string | null;
      text: string | null;
      suggestedTaskName: string | null;
      status: "PENDING" | "ASSIGNED" | "REJECTED";
      assignedPermitName: string | null;
      assignedTaskName: string | null;
      href: string | null;
    }
  | {
      kind: "incoming-media";
      direction: "incoming";
      id: string;
      at: string;
      authorName: string | null;
      authorPhone: string | null;
      fileName: string | null;
      mimeType: string | null;
      caption: string | null;
      suggestedTaskName: string | null;
      status: "PENDING" | "ASSIGNED" | "REJECTED";
      assignedPermitName: string | null;
      assignedTaskName: string | null;
      href: string | null;
    }
  | {
      kind: "outgoing-text";
      direction: "outgoing";
      id: string;
      at: string;
      actorName: string | null;
      text: string;
      idMessage: string | null;
      ok: boolean;
      error: string | null;
      href: string | null;
    };

export function ProjectWhatsAppTimeline({
  rows,
  page,
  pageSize,
  totalCount,
  basePath
}: {
  rows: TimelineRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  basePath: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const prevHref = page > 1 ? `${basePath}?page=${page - 1}` : null;
  const nextHref = page < totalPages ? `${basePath}?page=${page + 1}` : null;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageCircle className="size-3.5 text-emerald-600" />
          היסטוריית תקשורת
        </h2>
        <span className="text-[10px] text-muted-foreground">
          {totalCount === 0 ? "אין רשומות" : `${totalCount} רשומות`}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
          עוד אין תקשורת מתועדת לקבוצה הזו. שליחה דרך הכפתור למעלה או תיוג של
          המערכת בקבוצה יופיעו כאן.
        </p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <TimelineRowView key={`${r.direction}-${r.id}`} row={r} />
          ))}
        </ul>
      )}
      {totalCount > pageSize && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 text-[11px]">
          <div className="text-muted-foreground">
            עמוד {page} מתוך {totalPages}
          </div>
          <div className="flex gap-1">
            {prevHref ? (
              <Link
                href={prevHref}
                className="rounded border border-input bg-background px-2 py-0.5 hover:bg-accent"
              >
                ‹ הקודם
              </Link>
            ) : (
              <span className="rounded border border-input bg-background px-2 py-0.5 opacity-50">
                ‹ הקודם
              </span>
            )}
            {nextHref ? (
              <Link
                href={nextHref}
                className="rounded border border-input bg-background px-2 py-0.5 hover:bg-accent"
              >
                הבא ›
              </Link>
            ) : (
              <span className="rounded border border-input bg-background px-2 py-0.5 opacity-50">
                הבא ›
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineRowView({ row }: { row: TimelineRow }) {
  const incoming = row.direction === "incoming";
  // When the page supplies an href we wrap the inner content in a Link so
  // the whole row is clickable. The component intentionally keeps the row
  // semantics as `<li>` — the Link is the click target, not the list item.
  return (
    <li
      className={cn(
        "px-0 py-0",
        incoming ? "bg-card" : "bg-emerald-50/30 dark:bg-emerald-500/5"
      )}
    >
      <RowWrapper href={row.href}>
        <div
          className={cn(
            "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
            incoming
              ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
              : "bg-emerald-600 text-white"
          )}
          title={incoming ? "נכנס" : "יוצא"}
        >
          {incoming ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="font-medium">
              {row.direction === "incoming"
                ? row.authorName ?? "(לא מזוהה)"
                : `המערכת${row.actorName ? ` ע״י ${row.actorName}` : ""}`}
            </span>
            {row.direction === "incoming" && row.authorPhone && (
              <span className="text-muted-foreground" dir="ltr">
                {row.authorPhone}
              </span>
            )}
            <span className="text-muted-foreground" dir="ltr">
              {new Date(row.at).toLocaleString("he-IL")}
            </span>
          </div>
          <RowBody row={row} />
          <RowBadges row={row} />
        </div>
      </RowWrapper>
    </li>
  );
}

// Single source of truth for the row's flex layout — used either as a plain
// div (no href) or as a Link (drill-down enabled). Keeps the row's spacing
// identical in both modes.
function RowWrapper({
  href,
  children
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  const className =
    "flex flex-wrap items-start gap-2 px-3 py-2 transition-colors hover:bg-accent/40";
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={cn(className, "cursor-pointer")}>
      {children}
    </Link>
  );
}

function RowBody({ row }: { row: TimelineRow }) {
  if (row.kind === "incoming-text") {
    if (!row.text) {
      return (
        <p className="mt-0.5 text-[11px] italic text-muted-foreground">
          (הודעת טקסט ריקה)
        </p>
      );
    }
    return (
      <p className="mt-0.5 whitespace-pre-wrap text-[12px]">{row.text}</p>
    );
  }
  if (row.kind === "incoming-media") {
    return (
      <div className="mt-0.5 space-y-0.5">
        <div className="inline-flex items-center gap-1 text-[12px]">
          <Paperclip className="size-3 text-muted-foreground" />
          <span className="font-medium">{row.fileName ?? "(ללא שם)"}</span>
          {row.mimeType && (
            <span className="text-[10px] text-muted-foreground">· {row.mimeType}</span>
          )}
        </div>
        {row.caption && (
          <p className="whitespace-pre-wrap text-[11px] text-muted-foreground">
            {row.caption}
          </p>
        )}
      </div>
    );
  }
  return (
    <p className="mt-0.5 whitespace-pre-wrap text-[12px]">{row.text}</p>
  );
}

function RowBadges({ row }: { row: TimelineRow }) {
  if (row.direction === "outgoing") {
    if (row.ok) {
      return (
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge tone="emerald">נשלח</Badge>
          {row.idMessage && (
            <span className="text-[9.5px] text-muted-foreground" dir="ltr">
              id: {row.idMessage}
            </span>
          )}
        </div>
      );
    }
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        <Badge tone="red">
          <XCircle className="size-2.5" />
          נכשל
        </Badge>
        {row.error && (
          <span className="text-[10px] text-red-700">{row.error}</span>
        )}
      </div>
    );
  }

  // Incoming
  const badges: React.ReactNode[] = [];
  if (row.suggestedTaskName) {
    badges.push(
      <Badge tone="amber" key="suggested">
        <FileText className="size-2.5" />
        הוצע: {row.suggestedTaskName}
      </Badge>
    );
  }
  if (row.status === "ASSIGNED") {
    badges.push(
      <Badge tone="emerald" key="assigned">
        {row.assignedTaskName
          ? `תויג למשימה: ${row.assignedTaskName}`
          : row.assignedPermitName
            ? `תויג להיתר: ${row.assignedPermitName}`
            : "תויג"}
      </Badge>
    );
  } else if (row.status === "REJECTED") {
    badges.push(
      <Badge tone="red" key="rejected">
        <XCircle className="size-2.5" />
        נדחה
      </Badge>
    );
  } else if (row.status === "PENDING") {
    badges.push(
      <Badge tone="zinc" key="pending">
        <AlertTriangle className="size-2.5" />
        ממתין לטיפול
      </Badge>
    );
  }
  return badges.length > 0 ? <div className="mt-1 flex flex-wrap gap-1">{badges}</div> : null;
}

function Badge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "red" | "zinc";
}) {
  const palette = {
    emerald:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber:
      "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
    red: "border-red-300 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300",
    zinc: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-300"
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
        palette
      )}
    >
      {children}
    </span>
  );
}
