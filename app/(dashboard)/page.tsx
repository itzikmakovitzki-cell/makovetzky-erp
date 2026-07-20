import Link from "next/link";
import {
  FileCheck2,
  Building2,
  Wallet,
  Hourglass,
  Inbox as InboxIcon,
  AlertTriangle,
  Upload,
  CheckCircle2,
  FolderClock,
  ExternalLink,
  Activity,
  CalendarClock,
  Send,
  History,
  ArrowLeft,
  Plus,
  ListTodo
} from "lucide-react";
import type { AuditAction } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { greetingForHour, israelHour } from "@/lib/greeting";
import { Badge } from "@/components/ui/badge";
import {
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

// A permit is "stuck" if it sat without an update for this many days while
// not in a terminal status. Tuned to land in "needs admin attention" zone
// without being noisy on freshly-created records.
const STUCK_THRESHOLD_DAYS = 14;

// Lookback window for "recent activity" widgets. Anything older drops off
// the dashboard — the audit log remains authoritative for history.
const RECENT_WINDOW_DAYS = 30;

// Forward-looking window for "deadlines this week" — tasks due in the next
// 7 days (today inclusive) make the panel.
const UPCOMING_WINDOW_DAYS = 7;

const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "יצירה",
  UPDATE: "עדכון",
  DELETE: "מחיקה",
  STATUS_CHANGE: "שינוי סטטוס",
  ASSIGN: "שיוך",
  DEPENDENCY_OVERRIDE: "ביטול תלות",
  APPROVE: "אישור",
  REJECT: "דחייה"
};

export default async function HomeDashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_THRESHOLD_DAYS * 86_400_000);
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_DAYS * 86_400_000);
  // End-of-day so a task due today still falls inside the upcoming window.
  const upcomingStart = new Date(now);
  upcomingStart.setHours(0, 0, 0, 0);
  const upcomingEnd = new Date(now);
  upcomingEnd.setDate(upcomingEnd.getDate() + UPCOMING_WINDOW_DAYS);
  upcomingEnd.setHours(23, 59, 59, 999);

  // Fire all the read queries in parallel — the dashboard renders one frame.
  const [
    activePermitsCount,
    activeClientsCount,
    awaitingAuthorityCount,
    pendingDocs,
    stuckPermits,
    fieldUploads,
    upcomingTasks,
    submissions,
    categoryStatusRows,
    recentAudit
  ] = await Promise.all([
    prisma.permit.count({
      where: { deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } }
    }),
    prisma.client.count({
      where: {
        deletedAt: null,
        masterDeals: {
          some: {
            deletedAt: null,
            permits: {
              some: {
                deletedAt: null,
                status: { notIn: ["COMPLETED", "CANCELLED"] }
              }
            }
          }
        }
      }
    }),
    prisma.task.count({
      where: {
        deletedAt: null,
        status: "AWAITING_AUTHORITY",
        permit: { deletedAt: null }
      }
    }),
    isAdmin
      ? prisma.pendingDocument.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 6
        })
      : Promise.resolve([]),
    prisma.permit.findMany({
      where: {
        deletedAt: null,
        status: { in: ["IN_PROGRESS", "AWAITING_AUTHORITY", "DRAFT"] },
        updatedAt: { lt: stuckThreshold }
      },
      include: {
        authority: { select: { name: true } },
        masterDeal: {
          select: { client: { select: { companyName: true } } }
        }
      },
      orderBy: { updatedAt: "asc" },
      take: 8
    }),
    // Field-worker uploads = anonymous Document rows (uploadedById is null).
    // Pending review = isLatestApproved still false. Window-bound to the
    // recent lookback so old unreviewed uploads don't pile up here.
    prisma.document.findMany({
      where: {
        uploadedById: null,
        deletedAt: null,
        createdAt: { gte: recentSince }
      },
      include: {
        permit: { select: { id: true, name: true } },
        task: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    // Upcoming deadlines — every assignee sees their own; admin sees all.
    // Excludes COMPLETED + frozen tasks (the latter aren't burning anymore).
    prisma.task.findMany({
      where: {
        deletedAt: null,
        permit: { deletedAt: null },
        status: { notIn: ["COMPLETED"] },
        frozen: false,
        dueDate: { gte: upcomingStart, lte: upcomingEnd },
        ...(isAdmin ? {} : { assigneeId: session?.user?.id })
      },
      include: {
        permit: {
          select: {
            id: true,
            name: true,
            masterDeal: {
              select: { client: { select: { companyName: true } } }
            }
          }
        },
        assignee: { select: { name: true } }
      },
      orderBy: [{ dueDate: "asc" }, { isSpotlight: "desc" }],
      take: 10
    }),
    // Submissions across all active permits — drives the "ready to submit"
    // panel below (admin-only). We pair with categoryStatusRows to compute
    // which categories are at 100% completion but still PREPARING.
    isAdmin
      ? prisma.authoritySubmission.findMany({
          where: { permit: { deletedAt: null } },
          select: {
            permitId: true,
            category: true,
            status: true,
            permit: {
              select: {
                id: true,
                name: true,
                masterDeal: {
                  select: { client: { select: { companyName: true } } }
                }
              }
            }
          }
        })
      : Promise.resolve([]),
    isAdmin
      ? prisma.task.groupBy({
          by: ["permitId", "category", "status"],
          where: {
            deletedAt: null,
            permit: { deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } },
            category: { not: null }
          },
          _count: { _all: true }
        })
      : Promise.resolve([]),
    // Recent audit-log entries — short list with a "more" link to the
    // full viewer at /settings/audit-log.
    isAdmin
      ? prisma.auditLog.findMany({
          orderBy: { timestamp: "desc" },
          take: 6,
          include: { user: { select: { name: true } } }
        })
      : Promise.resolve([])
  ]);

  // Compute "ready to submit" — per (permit, category) pairs where every
  // task is COMPLETED but the submission row (if any) isn't SUBMITTED.
  // Implicit PREPARING (no submission row) counts as needing action.
  type ReadyEntry = {
    permitId: string;
    permitName: string;
    clientName: string;
    category: string;
    total: number;
  };
  const readyToSubmit: ReadyEntry[] = (() => {
    if (!isAdmin) return [];
    // Roll counts → per-(permit,category) totals + completed.
    type Bucket = {
      total: number;
      completed: number;
      permitName: string;
      clientName: string;
    };
    const buckets = new Map<string, Bucket>();
    for (const r of categoryStatusRows) {
      if (!r.category) continue;
      const key = `${r.permitId}::${r.category}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.total += r._count._all;
        if (r.status === "COMPLETED") existing.completed += r._count._all;
      } else {
        buckets.set(key, {
          total: r._count._all,
          completed: r.status === "COMPLETED" ? r._count._all : 0,
          permitName: "",
          clientName: ""
        });
      }
    }
    // Index submission status by (permitId, category) so we can look up
    // whether a row already moved past PREPARING.
    const submissionStatus = new Map<string, string>();
    const permitMeta = new Map<string, { name: string; client: string }>();
    for (const s of submissions) {
      submissionStatus.set(`${s.permitId}::${s.category}`, s.status);
      permitMeta.set(s.permitId, {
        name: s.permit.name,
        client: s.permit.masterDeal.client.companyName
      });
    }
    // Fallback for permits without any submission row yet — we need their
    // name/client. Pull from the bucket's permitId via a second pass.
    const out: ReadyEntry[] = [];
    for (const [key, b] of buckets) {
      if (b.total === 0 || b.completed < b.total) continue;
      const subStatus = submissionStatus.get(key);
      if (subStatus === "SUBMITTED" || subStatus === "APPROVED") continue;
      // Skip REJECTED — admin already saw it and chose not to resubmit yet.
      if (subStatus === "REJECTED") continue;
      const [permitId, category] = key.split("::");
      out.push({
        permitId,
        permitName: permitMeta.get(permitId)?.name ?? "",
        clientName: permitMeta.get(permitId)?.client ?? "",
        category,
        total: b.total
      });
    }
    return out;
  })();

  // For ready-to-submit rows whose permit doesn't have any submission row
  // yet, fill in the permit name/client via a tiny second lookup.
  const missingPermitIds = readyToSubmit
    .filter((r) => !r.permitName)
    .map((r) => r.permitId);
  if (missingPermitIds.length > 0) {
    const extra = await prisma.permit.findMany({
      where: { id: { in: missingPermitIds } },
      select: {
        id: true,
        name: true,
        masterDeal: {
          select: { client: { select: { companyName: true } } }
        }
      }
    });
    const byId = new Map(extra.map((p) => [p.id, p]));
    for (const r of readyToSubmit) {
      if (r.permitName) continue;
      const p = byId.get(r.permitId);
      if (p) {
        r.permitName = p.name;
        r.clientName = p.masterDeal.client.companyName;
      }
    }
  }
  readyToSubmit.sort((a, b) => a.permitName.localeCompare(b.permitName, "he"));

  const { greeting } = greetingForHour(israelHour(now));
  const firstName = session?.user?.name?.split(" ")[0] ?? "";

  // Resolve clickable preview URLs for any storage-backed files surfaced in
  // the panels below. External URLs (legacy data) pass through verbatim; the
  // signed batch is best-effort, so missing entries just render as plain text.
  const allFileUrls = [
    ...pendingDocs.map((d) => d.fileUrl),
    ...fieldUploads.map((d) => d.fileUrl)
  ];
  const storagePaths = allFileUrls.filter((u) => u && isStoragePath(u));
  const signedUrls = await createSignedUrlsSafe(storagePaths);
  const previewUrlFor = (fileUrl: string): string | null => {
    if (!fileUrl) return null;
    if (isStoragePath(fileUrl)) return signedUrls.get(fileUrl) ?? null;
    return fileUrl;
  };

  return (
    <section className="flex flex-col gap-7">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-brand-navy px-5 py-6 text-brand-cream shadow-[0_18px_55px_rgba(31,41,55,0.16)] md:px-8 md:py-8">
        <div aria-hidden className="absolute -start-20 -top-24 size-64 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-28 end-10 size-56 rounded-full bg-brand-cream/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-medium text-brand-cream/65">
              {new Date(now).toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              {greeting}{firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-brand-cream/72 md:text-base">
              {upcomingTasks.length > 0
                ? `יש ${upcomingTasks.length} משימות על הפרק השבוע. בואי נסגור את הדבר הבא ונמשיך משם.`
                : "הכול נראה רגוע כרגע. זה זמן טוב לקדם פרויקט אחד צעד נוסף."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/my-tasks" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-black/15 transition-colors duration-200 hover:bg-brand-orange-light">
              <ListTodo className="size-4" /> המשימות שלי <ArrowLeft className="size-4" />
            </Link>
            {isAdmin && (
              <Link href="/projects" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors duration-200 hover:bg-white/20">
                <Plus className="size-4" /> פרויקט חדש
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
         OPERATIONAL SECTION
         Per Block 23 the dashboard is 100% money-free — every monetary value
         lives only in /finances, reached via the discreet link below.
         ===================================================================== */}
      <div className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">תמונת היום</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight text-brand-navy">מה קורה בעסק עכשיו</h2>
          </div>
          <Activity className="size-5 text-muted-foreground/60" />
        </div>

        <div
          className={cn(
            "grid gap-3",
            isAdmin ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2"
          )}
        >
          <StatCard
            label="היתרים פעילים"
            value={activePermitsCount.toString()}
            icon={<FileCheck2 className="size-4 text-muted-foreground" />}
            helper="לא כולל הושלם/בוטל"
            href="/permits"
          />
          {isAdmin && (
            <StatCard
              label="לקוחות פעילים"
              value={activeClientsCount.toString()}
              icon={<Building2 className="size-4 text-muted-foreground" />}
              helper="לקוח עם היתר פעיל אחד לפחות"
              href="/clients"
            />
          )}
          <StatCard
            label="ממתין לרשות"
            value={awaitingAuthorityCount.toString()}
            icon={<Hourglass className="size-4 text-muted-foreground" />}
            helper="צוואר בקבוק — משימות תקועות אצל הרשות"
            href="/tasks?status=AWAITING_AUTHORITY"
            accent={awaitingAuthorityCount > 0 ? "warning" : undefined}
          />
        </div>

      <div
        className={cn(
          "grid gap-3",
          isAdmin ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        {isAdmin && (
          <Panel
            title="מסמכים נכנסים — ממתינים לטיפול"
            icon={<InboxIcon className="size-4 text-muted-foreground" />}
            count={pendingDocs.length}
            href="/inbox"
            hrefLabel="לתיבת הנכנסים"
          >
            {pendingDocs.length === 0 ? (
              <EmptyRow icon={<CheckCircle2 className="size-3 text-emerald-600" />}>
                אין מסמכים שממתינים לטיפול
              </EmptyRow>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>קובץ</th>
                    <th className="w-20">מקור</th>
                    <th>שולח</th>
                    <th className="w-28">התקבל</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDocs.map((d) => {
                    const url = previewUrlFor(d.fileUrl);
                    return (
                      <tr key={d.id} className="hover:bg-muted/30">
                        <td className="font-medium">
                          <FileNameLink url={url} fileName={d.fileName} />
                        </td>
                        <td className="text-[11px] text-muted-foreground">
                          {d.sourceChannel}
                        </td>
                        <td className="text-[11px] text-muted-foreground">
                          {d.senderInfo ?? "—"}
                        </td>
                        <td className="text-[11px] tabular-nums text-muted-foreground">
                          {formatDateTime(d.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        )}

        <Panel
          title={`היתרים תקועים מעל ${STUCK_THRESHOLD_DAYS} ימים`}
          icon={<AlertTriangle className="size-4 text-amber-600" />}
          count={stuckPermits.length}
          hint="ללא עדכון סטטוס/משימה"
        >
          {stuckPermits.length === 0 ? (
            <EmptyRow icon={<CheckCircle2 className="size-3 text-emerald-600" />}>
              אין היתרים תקועים — כל ההיתרים עודכנו לאחרונה
            </EmptyRow>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>שם היתר</th>
                  <th>לקוח</th>
                  <th>רשות</th>
                  <th className="w-24">סטטוס</th>
                  <th className="w-28">עודכן</th>
                </tr>
              </thead>
              <tbody>
                {stuckPermits.map((p) => {
                  const daysStuck = Math.floor(
                    (now.getTime() - new Date(p.updatedAt).getTime()) / 86_400_000
                  );
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td>
                        <Link
                          href={`/permits/${p.id}/tasks`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="text-xs">
                        {p.masterDeal.client.companyName}
                      </td>
                      <td className="text-xs">{p.authority.name}</td>
                      <td>
                        <Badge variant={PERMIT_STATUS_VARIANT[p.status]}>
                          {PERMIT_STATUS_LABEL[p.status]}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "text-[11px] tabular-nums",
                          daysStuck >= 30
                            ? "font-semibold text-red-600"
                            : "text-amber-700"
                        )}
                      >
                        לפני {daysStuck} ימים
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {/* Phase 4 of the polish sweep — surface the two windows that drive
          Bat-Or's daily action: categories that are ready to be sent to the
          authority (i.e. internal work is done, just needs the click), and
          tasks coming due this week. */}
      <div
        className={cn(
          "grid gap-3",
          isAdmin && readyToSubmit.length > 0 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        {isAdmin && readyToSubmit.length > 0 && (
          <Panel
            title="מוכן להגשה לרשות"
            icon={<Send className="size-4 text-emerald-600" />}
            count={readyToSubmit.length}
            hint="כל המשימות בקטגוריה הושלמו — אבל עדיין לא סומן 'ממתין לרשות'"
          >
            <table>
              <thead>
                <tr>
                  <th>היתר</th>
                  <th>לקוח</th>
                  <th>קטגוריה</th>
                  <th className="w-20 text-center">משימות</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {readyToSubmit.map((r) => (
                  <tr
                    key={`${r.permitId}-${r.category}`}
                    className="hover:bg-muted/30"
                  >
                    <td>
                      <Link
                        href={`/permits/${r.permitId}/tasks?category=${encodeURIComponent(r.category)}`}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {r.permitName}
                      </Link>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {r.clientName}
                    </td>
                    <td className="text-xs">{r.category}</td>
                    <td className="text-center text-xs tabular-nums">
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                        {r.total}/{r.total}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/permits/${r.permitId}/tasks?category=${encodeURIComponent(r.category)}`}
                        className="text-[11px] text-primary underline-offset-2 hover:underline"
                      >
                        שלח לרשות →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}

        <Panel
          title={isAdmin ? "דדליינים השבוע" : "המשימות שלי השבוע"}
          icon={<CalendarClock className="size-4 text-muted-foreground" />}
          count={upcomingTasks.length}
          hint={`עד ${UPCOMING_WINDOW_DAYS} ימים קדימה · לא כולל הושלם/מוקפא`}
          href="/my-tasks"
          hrefLabel="כל המשימות שלי"
        >
          {upcomingTasks.length === 0 ? (
            <EmptyRow icon={<CheckCircle2 className="size-3 text-emerald-600" />}>
              אין דדליינים בטווח של שבוע — קח אוויר
            </EmptyRow>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>משימה</th>
                  <th>פרויקט</th>
                  {isAdmin && <th className="w-32">אחראי</th>}
                  <th className="w-28">תאריך יעד</th>
                </tr>
              </thead>
              <tbody>
                {upcomingTasks.map((t) => {
                  const dayMs = 86_400_000;
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  const startToday = new Date(now);
                  startToday.setHours(0, 0, 0, 0);
                  const daysAway = due
                    ? Math.floor((due.getTime() - startToday.getTime()) / dayMs)
                    : null;
                  const tone =
                    daysAway === null
                      ? "text-muted-foreground"
                      : daysAway <= 1
                        ? "font-semibold text-red-600"
                        : daysAway <= 3
                          ? "text-amber-700"
                          : "text-muted-foreground";
                  const dayLabel =
                    daysAway === 0
                      ? "היום"
                      : daysAway === 1
                        ? "מחר"
                        : daysAway !== null
                          ? `בעוד ${daysAway} ימים`
                          : "—";
                  return (
                    <tr key={t.id} className="hover:bg-muted/30">
                      <td>
                        <Link
                          href={`/permits/${t.permit.id}/tasks`}
                          className="font-medium underline-offset-2 hover:underline"
                        >
                          {t.name}
                        </Link>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {t.permit.masterDeal.client.companyName} · {t.permit.name}
                      </td>
                      {isAdmin && (
                        <td className="text-xs text-muted-foreground">
                          {t.assignee?.name ?? "—"}
                        </td>
                      )}
                      <td className={cn("text-[11px] tabular-nums", tone)}>
                        {dayLabel}
                        {due && (
                          <span className="ms-1 text-muted-foreground">
                            ({formatDate(due)})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel
        title="העלאות מהשטח — דורש סקירה"
        icon={<Upload className="size-4 text-muted-foreground" />}
        count={fieldUploads.length}
        hint={`${RECENT_WINDOW_DAYS} ימים אחרונים · קישורי גישה (Magic Links)`}
      >
        {fieldUploads.length === 0 ? (
          <EmptyRow icon={<FolderClock className="size-3 text-muted-foreground" />}>
            אין העלאות חדשות מהשטח בטווח הזמן הזה
          </EmptyRow>
        ) : (
          <table>
            <thead>
              <tr>
                <th>קובץ</th>
                <th>היתר</th>
                <th>משימה</th>
                <th className="w-24">סטטוס סקירה</th>
                <th className="w-28">הועלה</th>
              </tr>
            </thead>
            <tbody>
              {fieldUploads.map((doc) => {
                const url = previewUrlFor(doc.fileUrl);
                return (
                <tr key={doc.id} className="hover:bg-muted/30">
                  <td className="font-medium">
                    <FileNameLink url={url} fileName={doc.fileName} />
                  </td>
                  <td className="text-xs">
                    {doc.permit ? (
                      <Link
                        href={`/permits/${doc.permit.id}/documents`}
                        className="underline-offset-2 hover:underline"
                      >
                        {doc.permit.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {doc.task?.name ?? "—"}
                  </td>
                  <td>
                    {doc.isLatestApproved ? (
                      <Badge variant="success">אושר</Badge>
                    ) : (
                      <Badge variant="warning">ממתין</Badge>
                    )}
                  </td>
                  <td className="text-[11px] tabular-nums text-muted-foreground">
                    {formatDateTime(doc.createdAt)}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
      </div>
      {/* ===== end of OPERATIONAL section ===== */}

      {isAdmin && recentAudit.length > 0 && (
        <Panel
          title="פעילות אחרונה במערכת"
          icon={<History className="size-4 text-muted-foreground" />}
          count={recentAudit.length}
          href="/settings/audit-log"
          hrefLabel="כל היומן"
          hint="6 הפעולות האחרונות"
        >
          <ul className="divide-y">
            {recentAudit.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px]"
              >
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                  {ACTION_LABEL[row.action]}
                </span>
                <span className="font-mono text-muted-foreground">
                  {row.entityType}
                </span>
                <span className="truncate text-muted-foreground">
                  · {row.user?.name ?? "מערכת"}
                </span>
                <span className="ms-auto shrink-0 tabular-nums text-muted-foreground">
                  {formatDateTime(row.timestamp)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Block 23: all monetary data lives ONLY in /finances now. The dashboard
          is intentionally money-free so it's safe to present to a client. */}
      {isAdmin && (
        <Link
          href="/finances"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Wallet className="size-3.5" />
          לניהול הכספים והגבייה
        </Link>
      )}
    </section>
  );
}

// Renders a file name as a clickable link when we have a URL, otherwise as
// plain text. URL is null for text-only inbox rows and for storage paths whose
// signed URL could not be resolved.
function FileNameLink({ url, fileName }: { url: string | null; fileName: string | null }) {
  const name = fileName ?? "ללא שם";
  if (!url) return <span>{name}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
      title="פתח קובץ"
    >
      <span className="truncate">{name}</span>
      <ExternalLink className="size-2.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

function StatCard({
  label,
  value,
  icon,
  helper,
  href,
  accent
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  helper: string;
  href?: string;
  accent?: "info" | "warning";
}) {
  const inner = (
    <div
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-white/80 bg-white/90 px-4 py-4 shadow-[0_8px_28px_rgba(31,41,55,0.07)] backdrop-blur transition-all duration-200",
        accent === "warning" &&
          "border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5",
        accent === "info" && "border-sky-500/40 bg-sky-50/50 dark:bg-sky-500/5",
        href &&
          "cursor-pointer hover:border-primary/30 hover:shadow-[0_14px_36px_rgba(31,41,55,0.12)] md:hover:-translate-y-0.5"
      )}
    >
      {/* Soft peach/orange blob in the corner — the landing-page card motif. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-8 -start-8 size-20 rounded-full bg-primary/10 blur-xl transition-opacity duration-300",
          accent === "warning" && "bg-amber-500/15",
          accent === "info" && "bg-sky-500/15",
          href && "group-hover:bg-primary/20"
        )}
      />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "transition-colors duration-200",
            href && "group-hover:text-primary"
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          "relative mt-3 text-3xl font-black leading-none tracking-tight tabular-nums",
          // Brand orange numbers by default (landing-card style); accent
          // variants keep their semantic color.
          !accent && "text-primary",
          accent === "warning" && "text-amber-800 dark:text-amber-300",
          accent === "info" && "text-sky-800 dark:text-sky-300"
        )}
      >
        {value}
      </div>
      <div className="relative mt-2 text-xs leading-relaxed text-muted-foreground">
        {helper}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Panel({
  title,
  icon,
  count,
  hint,
  href,
  hrefLabel,
  children
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  hint?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_8px_28px_rgba(31,41,55,0.065)] backdrop-blur transition-shadow duration-200 md:hover:shadow-[0_12px_34px_rgba(31,41,55,0.1)]">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-[#fbfaf7] px-4 py-3.5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-brand-navy">
            {title} ({count})
          </h2>
          {hint && (
            <span className="hidden text-[11px] text-muted-foreground xl:inline">· {hint}</span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            {hrefLabel ?? "פתח"}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({
  icon,
  children
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}
