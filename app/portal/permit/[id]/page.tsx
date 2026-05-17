import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Lock, Building2, Upload as UploadIcon } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { formatDate } from "@/lib/utils";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";
import {
  assertPortalAccessToPermit,
  getPortalScope,
  permitClientFilter
} from "@/lib/portal-access";
import {
  PortalTaskRow,
  type PortalTaskRowData
} from "@/components/portal/portal-task-row";
import { PortalUploadDialogTrigger } from "@/components/portal/portal-upload-trigger";

export const dynamic = "force-dynamic";

// Group key for the timeline. We order roughly: things waiting on you →
// active → blocked/waiting elsewhere → completed.
const STATUS_GROUP_ORDER: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "BLOCKED",
  "AWAITING_AUTHORITY",
  "COMPLETED"
];

export default async function PortalPermitDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, role: session.user.role };

  const { id: permitId } = await params;

  // Access check first — throws if no PortalAccess (and not admin).
  try {
    await assertPortalAccessToPermit(user, permitId);
  } catch {
    notFound();
  }

  // Now fetch the permit + tasks. We're explicit about includes/selects to
  // make absolutely sure no financial / supplier / note data leaks across
  // this boundary.
  const scope = await getPortalScope(user);
  const permit = await prisma.permit.findFirst({
    where: {
      id: permitId,
      deletedAt: null,
      ...permitClientFilter(scope)
    },
    select: {
      id: true,
      name: true,
      permitNumber: true,
      status: true,
      expectedCloseDate: true,
      startDate: true,
      closedAt: true,
      authority: { select: { name: true } },
      masterDeal: {
        select: { name: true, client: { select: { companyName: true } } }
      },
      _count: { select: { buildings: true } }
    }
  });
  if (!permit) notFound();

  // Contractors only see tasks assigned to them personally — admins viewing
  // the portal (for support) still see everything.
  const taskWhere = {
    permitId,
    deletedAt: null,
    ...(user.role === "CONTRACTOR" ? { assigneeId: user.id } : {})
  };
  const tasks = await prisma.task.findMany({
    where: taskWhere,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      dueDate: true,
      frozen: true,
      isSpotlight: true,
      documents: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, fileUrl: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  // One-shot signed-URL batch so each attached document gets a clickable
  // link. External URLs in legacy seeds pass through unchanged.
  const storagePaths = tasks
    .flatMap((t) => t.documents.map((d) => d.fileUrl))
    .filter(isStoragePath);
  const signed = await createSignedUrlsSafe(storagePaths);
  const previewUrlFor = (fileUrl: string): string | null => {
    if (!fileUrl) return null;
    if (isStoragePath(fileUrl)) return signed.get(fileUrl) ?? null;
    return fileUrl;
  };

  const now = new Date();
  const rows: PortalTaskRowData[] = tasks.map((t) => {
    // "Needs your attention" heuristic: BLOCKED, AWAITING_AUTHORITY with no
    // doc yet, or any open task that has no document attached. These are the
    // points where the client/contractor usually has to do something.
    const docs = t.documents;
    const needsAttention =
      t.status !== "COMPLETED" &&
      (t.status === "BLOCKED" ||
        ((t.status === "OPEN" || t.status === "AWAITING_AUTHORITY") &&
          docs.length === 0));
    const isOverdue =
      !t.frozen &&
      t.status !== "COMPLETED" &&
      t.dueDate !== null &&
      new Date(t.dueDate).getTime() < now.getTime();
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      isOverdue,
      needsAttention,
      documents: docs.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        previewUrl: previewUrlFor(d.fileUrl),
        uploadedAt: d.createdAt.toISOString()
      }))
    };
  });

  const grouped = STATUS_GROUP_ORDER.map((s) => ({
    status: s,
    rows: rows.filter((r) => r.status === s)
  })).filter((g) => g.rows.length > 0);

  const totalCount = rows.length;
  const completedCount = rows.filter((r) => r.status === "COMPLETED").length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const isLocked = permit.status === "COMPLETED";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לכל ההיתרים
        </Link>
      </div>

      <header className="rounded-md border bg-card p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold sm:text-base">{permit.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>
                <Building2 className="me-0.5 inline-block size-2.5 align-text-bottom" />
                {permit.masterDeal.client.companyName}
              </span>
              {permit.permitNumber && <span>· מספר היתר: {permit.permitNumber}</span>}
              <span>· רשות: {permit.authority.name}</span>
            </div>
          </div>
          <Badge variant={PERMIT_STATUS_VARIANT[permit.status]}>
            {PERMIT_STATUS_LABEL[permit.status]}
          </Badge>
        </div>

        {isLocked && (
          <div className="mt-3 flex items-center gap-2 rounded border border-amber-500/40 bg-amber-50/60 px-2.5 py-1.5 text-[11px] text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
            <Lock className="size-3 shrink-0" />
            ההיתר סגור — צפייה בלבד. לפתיחה מחדש פנה למנהל הפרויקט.
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4">
          <Stat label="פרויקט" value={permit.masterDeal.name} />
          <Stat label="בניינים" value={String(permit._count.buildings)} />
          <Stat label="תחילת עבודה" value={permit.startDate ? formatDate(permit.startDate) : "—"} />
          <Stat label="צפי סיום" value={permit.expectedCloseDate ? formatDate(permit.expectedCloseDate) : "—"} />
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>התקדמות משימות</span>
            <span className="tabular-nums">{completedCount}/{totalCount} · {progressPercent}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">משימות בהיתר</h2>
        {!isLocked && (
          <PortalUploadDialogTrigger permitId={permit.id} />
        )}
      </section>

      {grouped.length === 0 ? (
        <div className="rounded-md border bg-card p-6 text-center text-[12px] text-muted-foreground">
          טרם הוגדרו משימות בהיתר זה.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <section key={g.status} className="space-y-2">
              <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {sectionLabel(g.status)} <span className="tabular-nums">({g.rows.length})</span>
              </h3>
              <ul className="space-y-2">
                {g.rows.map((row) => (
                  <PortalTaskRow
                    key={row.id}
                    task={row}
                    permitId={permit.id}
                    permitLocked={isLocked}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

function sectionLabel(s: TaskStatus): string {
  switch (s) {
    case "OPEN":
      return "פתוחות";
    case "IN_PROGRESS":
      return "בתהליך";
    case "BLOCKED":
      return "חסומות";
    case "AWAITING_AUTHORITY":
      return "ממתינות לרשות";
    case "COMPLETED":
      return "הושלמו";
  }
}
