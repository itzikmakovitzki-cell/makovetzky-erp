import type { AuditAction, MilestoneStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_LABEL,
  ACTION_VARIANT,
  MILESTONE_STATUS_LABEL,
  MILESTONE_STATUS_VARIANT,
  TASK_STATUS_LABEL,
  TASK_STATUS_VARIANT
} from "@/lib/status-maps";
import { formatDate, formatDateTime, formatILS } from "@/lib/utils";

const NOTE_PREVIEW_LENGTH = 50;

export async function AuditLogTab({ permitId }: { permitId: string }) {
  const [tasks, notes, milestones, documents, pendingDocs] = await Promise.all([
    prisma.task.findMany({ where: { permitId }, select: { id: true, name: true } }),
    prisma.note.findMany({ where: { permitId }, select: { id: true, content: true } }),
    prisma.billingMilestone.findMany({
      where: { permitId },
      select: { id: true, name: true }
    }),
    prisma.document.findMany({
      where: { permitId },
      select: { id: true, fileName: true, version: true }
    }),
    prisma.pendingDocument.findMany({
      where: { assignedPermitId: permitId },
      select: { id: true, fileName: true }
    })
  ]);

  const taskNames = new Map(tasks.map((t) => [t.id, t.name]));
  const notePreviews = new Map(
    notes.map((n) => [n.id, n.content.slice(0, NOTE_PREVIEW_LENGTH)])
  );
  const milestoneNames = new Map(milestones.map((m) => [m.id, m.name]));
  const documentNames = new Map(
    documents.map((d) => [d.id, `${d.fileName} (v${d.version})`])
  );
  const pendingDocNames = new Map(
    pendingDocs.map((p) => [p.id, p.fileName ?? "מסמך נכנס"])
  );

  const taskIds = Array.from(taskNames.keys());
  const noteIds = Array.from(notePreviews.keys());
  const milestoneIds = Array.from(milestoneNames.keys());
  const documentIds = Array.from(documentNames.keys());
  const pendingDocIds = Array.from(pendingDocNames.keys());

  const logs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "PERMIT", entityId: permitId },
        ...(taskIds.length > 0
          ? [{ entityType: "TASK", entityId: { in: taskIds } }]
          : []),
        ...(noteIds.length > 0
          ? [{ entityType: "NOTE", entityId: { in: noteIds } }]
          : []),
        ...(milestoneIds.length > 0
          ? [{ entityType: "MILESTONE", entityId: { in: milestoneIds } }]
          : []),
        ...(documentIds.length > 0
          ? [{ entityType: "DOCUMENT", entityId: { in: documentIds } }]
          : []),
        ...(pendingDocIds.length > 0
          ? [{ entityType: "PENDING_DOCUMENT", entityId: { in: pendingDocIds } }]
          : [])
      ]
    },
    orderBy: { timestamp: "desc" },
    include: { user: { select: { id: true, name: true } } }
  });

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          יומן שינויים ({logs.length})
        </h2>
        <span className="text-[10px] text-muted-foreground">לקריאה בלבד · מהחדש לישן</span>
      </div>

      <table>
        <thead>
          <tr>
            <th className="w-28">זמן</th>
            <th className="w-28">פעולה</th>
            <th className="w-28">משתמש</th>
            <th>תיאור</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                אין רשומות ביומן השינויים עדיין. בצע פעולה (שינוי סטטוס, יצירת הערה וכו') והיא תופיע כאן.
              </td>
            </tr>
          )}
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-muted/30">
              <td className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                {formatDateTime(log.timestamp)}
              </td>
              <td>
                <Badge variant={ACTION_VARIANT[log.action]}>
                  {ACTION_LABEL[log.action]}
                </Badge>
              </td>
              <td className="text-xs">
                {log.user?.name ?? <span className="text-muted-foreground">מערכת</span>}
              </td>
              <td className="text-[12px] leading-relaxed">
                <AuditDescription
                  log={log}
                  taskNames={taskNames}
                  notePreviews={notePreviews}
                  milestoneNames={milestoneNames}
                  documentNames={documentNames}
                  pendingDocNames={pendingDocNames}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AuditLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue: unknown;
  newValue: unknown;
  timestamp: Date;
  user: { id: string; name: string } | null;
};

function AuditDescription({
  log,
  taskNames,
  notePreviews,
  milestoneNames,
  documentNames,
  pendingDocNames
}: {
  log: AuditLogRow;
  taskNames: Map<string, string>;
  notePreviews: Map<string, string>;
  milestoneNames: Map<string, string>;
  documentNames: Map<string, string>;
  pendingDocNames: Map<string, string>;
}) {
  const oldValue = (log.oldValue ?? {}) as Record<string, unknown>;
  const newValue = (log.newValue ?? {}) as Record<string, unknown>;

  if (log.entityType === "TASK") {
    const taskName = taskNames.get(log.entityId) ?? "(משימה לא נמצאה)";
    const taskRef = <Quoted>{taskName}</Quoted>;

    if (log.action === "STATUS_CHANGE") {
      const oldStatus = oldValue.status as TaskStatus;
      const newStatus = newValue.status as TaskStatus;
      const oldFrozen = Boolean(oldValue.frozen);
      const newFrozen = Boolean(newValue.frozen);
      return (
        <span>
          משימה {taskRef}: סטטוס שונה מ-
          <Badge variant={TASK_STATUS_VARIANT[oldStatus]} className="mx-0.5">
            {TASK_STATUS_LABEL[oldStatus]}
          </Badge>
          ל-
          <Badge variant={TASK_STATUS_VARIANT[newStatus]} className="mx-0.5">
            {TASK_STATUS_LABEL[newStatus]}
          </Badge>
          {oldFrozen !== newFrozen && (
            <span className="ms-1 text-amber-700 dark:text-amber-300">
              · {newFrozen ? "הופעלה הקפאת תאריך יעד" : "הוסרה הקפאת תאריך יעד"}
            </span>
          )}
        </span>
      );
    }

    if (log.action === "UPDATE" && "isSpotlight" in newValue) {
      const isOn = Boolean(newValue.isSpotlight);
      return (
        <span>
          {isOn ? "נוסף Managerial Spotlight למשימה " : "הוסר Managerial Spotlight מהמשימה "}
          {taskRef}
        </span>
      );
    }

    if (log.action === "DEPENDENCY_OVERRIDE") {
      const depName =
        (newValue.overriddenDependsOnName as string | undefined) ?? "(לא צוין)";
      return (
        <span>
          עקיפת תלות במשימה {taskRef} — הוסרה החסימה שמגיעה מהמשימה{" "}
          <Quoted>{depName}</Quoted>
        </span>
      );
    }
  }

  if (log.entityType === "NOTE") {
    if (log.action === "CREATE") {
      const preview =
        (newValue.contentPreview as string | undefined) ??
        notePreviews.get(log.entityId) ??
        "";
      return (
        <span>
          נוצרה הערה חדשה:{" "}
          <span className="text-muted-foreground">&ldquo;{preview}…&rdquo;</span>
        </span>
      );
    }

    if (log.action === "UPDATE" && "isPinned" in newValue) {
      const isPinned = Boolean(newValue.isPinned);
      const preview = notePreviews.get(log.entityId);
      return (
        <span>
          {isPinned ? "הצמדת הערה לראש הרשימה" : "ביטול הצמדת הערה"}
          {preview && (
            <span className="text-muted-foreground"> · &ldquo;{preview}…&rdquo;</span>
          )}
        </span>
      );
    }

    if (log.action === "DELETE") {
      const preview = (oldValue.contentPreview as string | undefined) ?? "";
      return (
        <span>
          נמחקה הערה:{" "}
          <span className="text-muted-foreground">&ldquo;{preview}…&rdquo;</span>
        </span>
      );
    }
  }

  if (log.entityType === "MILESTONE") {
    const milestoneName =
      milestoneNames.get(log.entityId) ??
      (newValue.name as string | undefined) ??
      (oldValue.name as string | undefined) ??
      "(אבן דרך לא נמצאה)";
    const milestoneRef = <Quoted>{milestoneName}</Quoted>;

    if (log.action === "CREATE") {
      const amount = Number(newValue.amount ?? 0);
      return (
        <span>
          נוצרה אבן דרך חדשה {milestoneRef} בסכום{" "}
          <span className="font-semibold tabular-nums">{formatILS(amount)}</span>
        </span>
      );
    }

    if (log.action === "STATUS_CHANGE") {
      const oldStatus = oldValue.status as MilestoneStatus;
      const newStatus = newValue.status as MilestoneStatus;
      const triggeredByTask = newValue.triggeredByTaskId as string | undefined;
      const triggeredByTaskName = triggeredByTask
        ? taskNames.get(triggeredByTask)
        : undefined;
      const amount = newValue.amount ? Number(newValue.amount) : undefined;
      return (
        <span>
          אבן דרך {milestoneRef}: סטטוס שונה מ-
          <Badge variant={MILESTONE_STATUS_VARIANT[oldStatus]} className="mx-0.5">
            {MILESTONE_STATUS_LABEL[oldStatus]}
          </Badge>
          ל-
          <Badge variant={MILESTONE_STATUS_VARIANT[newStatus]} className="mx-0.5">
            {MILESTONE_STATUS_LABEL[newStatus]}
          </Badge>
          {newStatus === "DUE" && triggeredByTaskName && (
            <span className="ms-1 text-muted-foreground">
              · הופעלה ע״י השלמת <Quoted>{triggeredByTaskName}</Quoted>
            </span>
          )}
          {newStatus === "PAID" && amount && (
            <span className="ms-1 text-emerald-700 dark:text-emerald-300">
              · {formatILS(amount)} התקבל
            </span>
          )}
        </span>
      );
    }

    if (log.action === "UPDATE") {
      const changes: React.ReactNode[] = [];
      if (oldValue.name !== newValue.name) {
        changes.push(
          <span key="name">
            שם: <em>&ldquo;{String(oldValue.name)}&rdquo;</em> →{" "}
            <em>&ldquo;{String(newValue.name)}&rdquo;</em>
          </span>
        );
      }
      if (Number(oldValue.amount) !== Number(newValue.amount)) {
        changes.push(
          <span key="amount">
            סכום: <span className="tabular-nums">{formatILS(Number(oldValue.amount))}</span>{" "}
            → <span className="tabular-nums">{formatILS(Number(newValue.amount))}</span>
          </span>
        );
      }
      if (oldValue.triggerTaskId !== newValue.triggerTaskId) {
        const oldTaskName =
          taskNames.get(oldValue.triggerTaskId as string) ?? "(לא נמצאה)";
        const newTaskName =
          taskNames.get(newValue.triggerTaskId as string) ?? "(לא נמצאה)";
        changes.push(
          <span key="task">
            משימה מפעילה: <Quoted>{oldTaskName}</Quoted> → <Quoted>{newTaskName}</Quoted>
          </span>
        );
      }
      if (oldValue.dueDate !== newValue.dueDate) {
        changes.push(
          <span key="due">
            תאריך יעד: {formatDate((oldValue.dueDate as string) ?? null)} →{" "}
            {formatDate((newValue.dueDate as string) ?? null)}
          </span>
        );
      }
      return (
        <span>
          עודכנה אבן דרך {milestoneRef}
          {changes.length > 0 && (
            <span className="text-muted-foreground"> · </span>
          )}
          {changes.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1 text-muted-foreground/50">·</span>}
              {c}
            </span>
          ))}
        </span>
      );
    }
  }

  if (log.entityType === "DOCUMENT") {
    const docName =
      documentNames.get(log.entityId) ??
      (newValue.fileName as string | undefined) ??
      (oldValue.fileName as string | undefined) ??
      "(מסמך לא נמצא)";
    const docRef = <Quoted>{docName}</Quoted>;

    if (log.action === "CREATE") {
      const version = (newValue.version as number | undefined) ?? 1;
      const taskName = newValue.taskName as string | undefined;
      const buildingLabel = newValue.buildingLabel as string | undefined;
      const fromPending = newValue.fromPendingDocId as string | undefined;
      const source = newValue.source as string | undefined;
      return (
        <span>
          הועלה מסמך חדש {docRef}{" "}
          <span className="text-muted-foreground">
            (גרסה <span className="font-mono">{version}</span>)
          </span>
          {taskName && (
            <span> · משויך למשימה <Quoted>{taskName}</Quoted></span>
          )}
          {buildingLabel && (
            <span className="text-muted-foreground"> · יחידה: {buildingLabel}</span>
          )}
          {fromPending && source && (
            <Badge variant="info" className="ms-1">
              מקור: {source}
            </Badge>
          )}
        </span>
      );
    }

    if (log.action === "APPROVE") {
      const version = (newValue.version as number | undefined) ?? 1;
      const supersededCount =
        (newValue.supersededCount as number | undefined) ?? 0;
      return (
        <span>
          אושר מסמך {docRef}{" "}
          <span className="text-muted-foreground">
            (גרסה <span className="font-mono">{version}</span>)
          </span>{" "}
          וסומן כגרסה האחרונה
          {supersededCount > 0 && (
            <span className="ms-1 text-muted-foreground">
              · {supersededCount === 1
                ? "גרסה קודמת איבדה את סימון 'אחרון'"
                : `${supersededCount} גרסאות קודמות איבדו את סימון 'אחרון'`}
            </span>
          )}
        </span>
      );
    }
  }

  if (log.entityType === "PENDING_DOCUMENT") {
    const fileName =
      pendingDocNames.get(log.entityId) ??
      (newValue.fileName as string | undefined) ??
      (oldValue.fileName as string | undefined) ??
      "(מסמך נכנס)";
    const docRef = <Quoted>{fileName}</Quoted>;
    const source = newValue.source as string | undefined;

    if (log.action === "ASSIGN") {
      const taskName = newValue.taskName as string | undefined;
      const buildingLabel = newValue.buildingLabel as string | undefined;
      return (
        <span>
          מסמך נכנס {docRef} שויך{" "}
          {taskName ? (
            <>למשימה <Quoted>{taskName}</Quoted></>
          ) : (
            <>להיתר זה</>
          )}
          {buildingLabel && (
            <span className="text-muted-foreground"> · יחידה: {buildingLabel}</span>
          )}
          {source && (
            <Badge variant="info" className="ms-1">
              מקור: {source}
            </Badge>
          )}
        </span>
      );
    }
    if (log.action === "REJECT") {
      const reason = newValue.rejectionReason as string | undefined;
      return (
        <span>
          מסמך נכנס {docRef} נדחה
          {reason && (
            <span className="text-muted-foreground"> · סיבה: &ldquo;{reason}&rdquo;</span>
          )}
        </span>
      );
    }
  }

  return (
    <span className="text-muted-foreground">
      {log.entityType} · {ACTION_LABEL[log.action] ?? log.action}
    </span>
  );
}

function Quoted({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-foreground">&ldquo;{children}&rdquo;</span>;
}
