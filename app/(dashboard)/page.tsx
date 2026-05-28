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
  Activity
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/global/page-header";
import {
  PERMIT_STATUS_LABEL,
  PERMIT_STATUS_VARIANT
} from "@/lib/status-maps";
import { cn, formatDateTime } from "@/lib/utils";
import { createSignedUrlsSafe, isStoragePath } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

// A permit is "stuck" if it sat without an update for this many days while
// not in a terminal status. Tuned to land in "needs admin attention" zone
// without being noisy on freshly-created records.
const STUCK_THRESHOLD_DAYS = 14;

// Lookback window for "recent activity" widgets. Anything older drops off
// the dashboard — the audit log remains authoritative for history.
const RECENT_WINDOW_DAYS = 30;

export default async function HomeDashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_THRESHOLD_DAYS * 86_400_000);
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_DAYS * 86_400_000);

  // Fire all the read queries in parallel — the dashboard renders one frame.
  const [
    activePermitsCount,
    activeClientsCount,
    awaitingAuthorityCount,
    pendingDocs,
    stuckPermits,
    fieldUploads
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
    })
  ]);

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
    <section className="flex flex-col gap-6">
      <PageHeader
        title="מבט-על"
        accent={isAdmin ? "מנהל" : undefined}
        description={
          isAdmin
            ? "תמונת מצב חוצת-לקוחות וצווארי בקבוק שדורשים טיפול."
            : "סטטוס פרויקטים פעילים ופעילות אחרונה."
        }
      />

      {/* =====================================================================
         OPERATIONAL SECTION (top)
         Per Block 19: this entire block must stay free of monetary values so
         the screen is safe to face a client. Anything money-coded lives in
         the ClientModeShield-wrapped financial section at the bottom.
         ===================================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 border-b border-border/60 pb-2">
          <Activity className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">תפעול</h2>
          <span className="text-[10px] text-muted-foreground">
            סטטוסי פרויקטים, משימות, צווארי בקבוק
          </span>
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
        "group relative h-full overflow-hidden rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-sm transition-all duration-200 md:shadow-[0_2px_8px_rgba(19,25,44,0.06),0_0_0_1px_rgba(0,0,0,0.02)]",
        accent === "warning" &&
          "border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5",
        accent === "info" && "border-sky-500/40 bg-sky-50/50 dark:bg-sky-500/5",
        href &&
          "cursor-pointer hover:border-primary/30 hover:shadow-lg md:hover:-translate-y-0.5"
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
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          "relative mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums md:text-[1.4rem]",
          // Brand orange numbers by default (landing-card style); accent
          // variants keep their semantic color.
          !accent && "text-primary",
          accent === "warning" && "text-amber-800 dark:text-amber-300",
          accent === "info" && "text-sky-800 dark:text-sky-300"
        )}
      >
        {value}
      </div>
      <div className="relative mt-1 text-[10.5px] leading-snug text-muted-foreground">
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
    <div className="rounded-lg border border-border/70 bg-card shadow-sm transition-shadow duration-200 md:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.02)] md:hover:shadow-md">
      <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title} ({count})
          </h2>
          {hint && (
            <span className="text-[10px] text-muted-foreground">· {hint}</span>
          )}
        </div>
        {href && (
          <Link
            href={href}
            className="text-[11px] font-medium text-foreground/70 underline-offset-2 transition-colors hover:text-foreground hover:underline"
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
    <div className="flex items-center justify-center gap-1.5 py-6 text-xs text-muted-foreground">
      {icon}
      <span>{children}</span>
    </div>
  );
}
