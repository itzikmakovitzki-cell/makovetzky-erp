import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Lock, Building2, FileText, ExternalLink, ListChecks, FolderOpen, Sparkles, Users } from "lucide-react";
import { ContactsGrid } from "@/components/contacts/contacts-grid";
import type { TaskStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_VARIANT } from "@/lib/status-maps";
import { cn, formatDate } from "@/lib/utils";
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
import type { TaskNotesViewer } from "@/components/tasks/task-notes-panel";

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
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, role: session.user.role };

  const { id: permitId } = await params;
  const sp = await searchParams;
  // Block 33: three server-rendered tabs on this page — "timeline"
  // (default, tasks), "docs" (construction documents archive), and
  // "contacts" (Project Contacts Directory). Anything else snaps back to
  // the timeline so a stray URL never lands the user on a blank screen.
  const activeTab: "timeline" | "docs" | "contacts" =
    sp.tab === "docs" ? "docs" : sp.tab === "contacts" ? "contacts" : "timeline";

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

  // Block 30: contractors now see every task on the permit, not just the
  // ones assigned to them. Tasks where they're not the assignee render
  // read-only (no upload button, dimmed) — the security boundary stays:
  // PortalAccess gates the *permit*, the per-task assignee flag drives
  // what they can *modify*.
  const tasks = await prisma.task.findMany({
    where: { permitId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      dueDate: true,
      frozen: true,
      isSpotlight: true,
      responsibility: true,
      assigneeId: true,
      documents: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, fileUrl: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      },
      // Block 34 — per-task progress log. Newest first so the row's
      // collapsed preview shows the most recent entry.
      notes: {
        select: {
          id: true,
          content: true,
          createdAt: true,
          updatedAt: true,
          authorId: true,
          author: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ createdAt: "asc" }]
  });

  // Block 30: the "docs" tab also surfaces permit-level documents (those
  // not bound to a specific task — general construction archive). Pulled
  // here so the signed-URL batch covers both task-level docs and archive
  // docs in one Supabase round-trip.
  const archiveDocs = await prisma.document.findMany({
    where: { permitId, taskId: null, deletedAt: null },
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      createdAt: true,
      mimeType: true,
      sizeBytes: true
    },
    orderBy: { createdAt: "desc" }
  });

  // One-shot signed-URL batch so each attached document gets a clickable
  // link. External URLs in legacy seeds pass through unchanged.
  const storagePaths = [
    ...tasks.flatMap((t) => t.documents.map((d) => d.fileUrl)),
    ...archiveDocs.map((d) => d.fileUrl)
  ].filter(isStoragePath);
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
    // Read-only for contractors when the task isn't assigned to them.
    // Admins / employees keep full control (they're viewing the portal
    // for support).
    const isReadOnly =
      user.role === "CONTRACTOR" && t.assigneeId !== user.id;
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      isOverdue,
      needsAttention: needsAttention && !isReadOnly,
      responsibility: t.responsibility,
      documents: docs.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        previewUrl: previewUrlFor(d.fileUrl),
        uploadedAt: d.createdAt.toISOString()
      })),
      isReadOnly,
      notes: t.notes.map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        authorId: n.authorId,
        authorName: n.author?.name ?? null
      }))
    };
  });

  // Viewer identity for the notes panel (mirrors the back-office wiring).
  const viewer: TaskNotesViewer = {
    id: user.id,
    role: user.role as TaskNotesViewer["role"]
  };

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
      {/* Block 32: contextual marketplace entry. The back-link stays on the
          right (RTL leading edge), the marketplace CTA mirrors it on the
          left so clients deep inside a permit still see the partners
          shortcut without scrolling back out to /portal. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לכל ההיתרים
        </Link>
        <Link
          href="/portal/partners"
          className="group inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-[11.5px] font-semibold text-primary transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/10 hover:shadow-sm"
        >
          <Sparkles className="size-3 transition-transform group-hover:rotate-12" />
          למאגר השותפים וההטבות
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

      {/* Tabs — server-rendered via search params so we keep zero client-
          side state on the portal page. Three views: ציר זמן (default),
          מסמכי בנייה (Block 30 archive), and אנשי קשר (Block 33
          directory). */}
      <nav
        role="tablist"
        aria-label="תצוגת היתר"
        className="flex flex-wrap items-center gap-1 border-b"
      >
        <PortalTab
          href={`/portal/permit/${permit.id}`}
          active={activeTab === "timeline"}
          icon={<ListChecks className="size-3.5" />}
          label="ציר זמן ומשימות"
        />
        <PortalTab
          href={`/portal/permit/${permit.id}?tab=docs`}
          active={activeTab === "docs"}
          icon={<FolderOpen className="size-3.5" />}
          label={`מסמכי בנייה (${archiveDocs.length})`}
        />
        <PortalTab
          href={`/portal/permit/${permit.id}?tab=contacts`}
          active={activeTab === "contacts"}
          icon={<Users className="size-3.5" />}
          label="אנשי קשר"
        />
      </nav>

      {activeTab === "timeline" && (
        <>
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
                        viewer={viewer}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "docs" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold">ארכיון מסמכי בנייה</h2>
              <p className="text-[11px] text-muted-foreground">
                מסמכים כלליים של הפרויקט — טפסי בדיקות, אישורי תקן, היתרים,
                ומה שהקבלן צריך להעלות לתיק. מסמכים שמוצמדים למשימה ספציפית
                מוצגים בלשונית &quot;ציר זמן ומשימות&quot;.
              </p>
            </div>
            {!isLocked && (
              <PortalUploadDialogTrigger permitId={permit.id} />
            )}
          </div>

          {archiveDocs.length === 0 ? (
            <div className="rounded-md border bg-card p-6 text-center text-[12px] text-muted-foreground">
              עוד לא הועלו מסמכי בנייה. הקלק על &quot;העלאת מסמך כללי&quot;
              כדי להוסיף.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {archiveDocs.map((d) => {
                const url = previewUrlFor(d.fileUrl);
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-w-0 items-center gap-1 text-[12px] font-medium underline-offset-2 hover:underline"
                        >
                          <span className="truncate">{d.fileName}</span>
                          <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
                        </a>
                      ) : (
                        <span className="text-[12px] font-medium">{d.fileName}</span>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {formatDate(d.createdAt)}
                        {d.sizeBytes != null && (
                          <span className="ms-1">
                            · {Math.max(1, Math.round(d.sizeBytes / 1024))} KB
                          </span>
                        )}
                        {d.mimeType && <span className="ms-1">· {d.mimeType}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {activeTab === "contacts" && (
        /* Portal-side directory: same renderer the back-office uses.
           canManage is hard-false here so contractors can add but not
           edit/delete — Block 33 brief. */
        <ContactsGrid permitId={permit.id} canManage={false} variant="embedded" />
      )}
    </div>
  );
}

function PortalTab({
  href,
  active,
  icon,
  label
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-[12px] transition-colors",
        active
          ? "border-foreground font-semibold text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
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
