import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity } from "@/lib/audit";
import { Badge } from "@/components/ui/badge";
import { AuditLogFilters } from "@/components/settings/audit-log-filters";
import { AuditLogJsonCell } from "@/components/settings/audit-log-json-cell";
import { AuditLogPagination } from "@/components/settings/audit-log-pagination";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

// Friendly Hebrew labels for the action enum so the column reads like
// natural language instead of CREATE/UPDATE/STATUS_CHANGE.
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

const ACTION_TONE: Record<AuditAction, "default" | "muted" | "destructive"> = {
  CREATE: "default",
  UPDATE: "muted",
  DELETE: "destructive",
  STATUS_CHANGE: "muted",
  ASSIGN: "muted",
  DEPENDENCY_OVERRIDE: "muted",
  APPROVE: "default",
  REJECT: "destructive"
};

// Entity types we expose in the filter dropdown. Sourced from the
// AuditEntity const map so adding a new entity type elsewhere shows up
// here automatically once a row is written.
const ENTITY_OPTIONS: string[] = Object.values(AuditEntity);

const VALID_ACTIONS = new Set<AuditAction>(Object.keys(ACTION_LABEL) as AuditAction[]);

function parseDateInput(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function AuditLogPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Audit log is sensitive — ADMIN-only, matching the rest of /settings.
  await requireRole(["ADMIN"]);

  const params = await searchParams;
  // Accept both `entity` (used by the filter dropdown) and `entityType`
  // (used by deep-links such as the WhatsApp timeline drill-down).
  const entityParam =
    typeof params.entity === "string" && params.entity.trim()
      ? params.entity.trim()
      : typeof params.entityType === "string" && params.entityType.trim()
        ? params.entityType.trim()
        : null;
  // Deep-link drill-down: restrict to a single entity instance (e.g. the
  // events for one specific MASTER_DEAL). No UI control writes this — it
  // comes only from URLs built by other pages.
  const entityIdParam =
    typeof params.entityId === "string" && params.entityId.trim()
      ? params.entityId.trim()
      : null;
  const actionParam =
    typeof params.action === "string" &&
    VALID_ACTIONS.has(params.action as AuditAction)
      ? (params.action as AuditAction)
      : null;
  const userParam =
    typeof params.user === "string" && params.user.trim()
      ? params.user.trim()
      : null;
  const fromRaw = typeof params.from === "string" ? params.from : undefined;
  const toRaw = typeof params.to === "string" ? params.to : undefined;
  const from = parseDateInput(fromRaw);
  const toExclusive = (() => {
    const t = parseDateInput(toRaw);
    if (!t) return null;
    // Inclusive UI → exclusive query (advance one day).
    const out = new Date(t);
    out.setDate(out.getDate() + 1);
    return out;
  })();
  const pageRaw =
    typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const where: Prisma.AuditLogWhereInput = {};
  if (entityParam) where.entityType = entityParam;
  if (entityIdParam) where.entityId = entityIdParam;
  if (actionParam) where.action = actionParam;
  if (userParam) where.userId = userParam;
  if (from || toExclusive) {
    where.timestamp = {};
    if (from) where.timestamp.gte = from;
    if (toExclusive) where.timestamp.lt = toExclusive;
  }

  const [total, rows, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    }),
    // Drives the "by user" filter dropdown — small set, fine to ship all.
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <AuditLogFilters
        entityOptions={ENTITY_OPTIONS}
        actionOptions={Object.entries(ACTION_LABEL).map(([value, label]) => ({
          value,
          label
        }))}
        userOptions={users.map((u) => ({ id: u.id, name: u.name }))}
        currentEntity={entityParam}
        currentEntityId={entityIdParam}
        currentAction={actionParam}
        currentUser={userParam}
        currentFrom={fromRaw ?? null}
        currentTo={toRaw ?? null}
      />

      <div className="rounded-md border bg-card">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            יומן פעולות ({total})
          </h2>
        </div>

        <div className="md:hidden flex flex-col gap-2 p-2">
          {rows.length === 0 ? (
            <div className="rounded-md border bg-card py-6 text-center text-xs text-muted-foreground">
              אין רשומות התואמות לסינון.
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge variant={ACTION_TONE[r.action]}>
                    {ACTION_LABEL[r.action]}
                  </Badge>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {new Date(r.timestamp).toLocaleString("he-IL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
                <div className="text-[11px]">
                  {r.user ? (
                    <span>
                      <span className="font-medium">{r.user.name}</span>
                      <span className="ms-1 text-[10px] text-muted-foreground">
                        ({r.user.email})
                      </span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div
                  className={cn(
                    "font-mono text-[10px] text-muted-foreground",
                    !ENTITY_OPTIONS.includes(r.entityType) && "italic"
                  )}
                >
                  {r.entityType} · {r.entityId}
                </div>
                <AuditLogJsonCell
                  oldValue={r.oldValue as unknown}
                  newValue={r.newValue as unknown}
                />
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
        <table className="min-w-[760px]">
          <thead>
            <tr>
              <th className="w-36">זמן</th>
              <th className="w-32">פעולה</th>
              <th className="w-40">סוג ישות</th>
              <th className="w-48">מזהה ישות</th>
              <th className="w-36">משתמש</th>
              <th>שינוי</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                  אין רשומות התואמות לסינון.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="align-top hover:bg-muted/30">
                <td className="text-[11px] tabular-nums text-muted-foreground">
                  {new Date(r.timestamp).toLocaleString("he-IL", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </td>
                <td>
                  <Badge variant={ACTION_TONE[r.action]}>
                    {ACTION_LABEL[r.action]}
                  </Badge>
                </td>
                <td
                  className={cn(
                    "font-mono text-[11px] text-muted-foreground",
                    !ENTITY_OPTIONS.includes(r.entityType) && "italic"
                  )}
                  title={
                    !ENTITY_OPTIONS.includes(r.entityType)
                      ? "סוג ישות שלא במפת AuditEntity הסטנדרטית"
                      : undefined
                  }
                >
                  {r.entityType}
                </td>
                <td className="font-mono text-[10px] text-muted-foreground">
                  {r.entityId}
                </td>
                <td className="text-[12px]">
                  {r.user ? (
                    <div className="flex flex-col">
                      <span>{r.user.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.user.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td>
                  <AuditLogJsonCell
                    oldValue={r.oldValue as unknown}
                    newValue={r.newValue as unknown}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {total > PAGE_SIZE && (
          <div className="border-t bg-muted/20 px-3 py-2">
            <AuditLogPagination page={page} totalPages={totalPages} />
          </div>
        )}
      </div>
    </div>
  );
}
