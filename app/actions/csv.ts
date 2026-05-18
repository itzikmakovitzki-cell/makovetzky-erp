"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  Prisma,
  TaskPriority,
  TaskResponsibility,
  TaskStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import {
  TASK_RESPONSIBILITY_HE_TO_ENUM,
  TASK_RESPONSIBILITY_LABEL
} from "@/lib/status-maps";
import {
  buildCsv,
  EMPTY_IMPORT_RESULT,
  formatDateForCsv,
  parseCsv,
  parseFlexibleDate,
  rowsToObjects,
  safeFileSegment,
  todayStamp,
  type ExportResult,
  type ImportResult
} from "@/lib/csv";

// Tags travel as pipe-separated values inside a single CSV cell — commas
// would clash with the CSV separator if a tag ever contained one.
function parseTagsCell(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split("|")) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

// All actions in this module write/read CSV. Imports are uniformly
// gated to ADMIN; exports loosen to EMPLOYEE only where the underlying
// page is already visible to employees (currently: permit tasks).

async function fileToText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return new TextDecoder("utf-8").decode(buf);
}

// ============================================================================
// CLIENTS
// ============================================================================

const CLIENT_HEADERS = [
  "שם החברה",
  "ח.פ.",
  "איש קשר",
  "טלפון",
  "אימייל",
  "כתובת",
  "הערות"
];

export async function exportClientsCsv(): Promise<ExportResult> {
  try {
    await requireRole(["ADMIN"]);
    const clients = await prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { companyName: "asc" }
    });
    const rows = clients.map((c) => [
      c.companyName,
      c.hp ?? "",
      c.contactName,
      c.phone,
      c.email ?? "",
      c.address ?? "",
      c.notes ?? ""
    ]);
    return {
      ok: true,
      error: null,
      csv: buildCsv(CLIENT_HEADERS, rows),
      filename: `clients_${todayStamp()}.csv`
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      csv: "",
      filename: ""
    };
  }
}

export async function importClientsCsv(
  formData: FormData
): Promise<ImportResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "יש לבחור קובץ CSV" };
    }
    const parsed = rowsToObjects(parseCsv(await fileToText(file)));
    if (!parsed || parsed.data.length === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "הקובץ ריק או לא תקין" };
    }
    const errors: { row: number; message: string }[] = [];
    const toCreate: Array<{
      companyName: string;
      hp: string | null;
      contactName: string;
      phone: string;
      email: string | null;
      address: string | null;
      notes: string | null;
    }> = [];

    const existing = await prisma.client.findMany({
      where: { deletedAt: null },
      select: { companyName: true }
    });
    const existingNames = new Set(
      existing.map((c) => c.companyName.toLowerCase())
    );
    const seenInThisFile = new Set<string>();
    let skipped = 0;

    parsed.data.forEach((row, idx) => {
      const lineNum = idx + 2; // +1 header, +1 1-based
      const companyName = (row["שם החברה"] || "").trim();
      const contactName = (row["איש קשר"] || "").trim();
      const phone = (row["טלפון"] || "").trim();
      if (!companyName) {
        errors.push({ row: lineNum, message: "חסר שם חברה" });
        return;
      }
      if (!contactName) {
        errors.push({ row: lineNum, message: "חסר שם איש קשר" });
        return;
      }
      if (!phone) {
        errors.push({ row: lineNum, message: "חסר טלפון" });
        return;
      }
      const key = companyName.toLowerCase();
      if (existingNames.has(key) || seenInThisFile.has(key)) {
        skipped++;
        return;
      }
      seenInThisFile.add(key);
      toCreate.push({
        companyName,
        contactName,
        phone,
        hp: (row["ח.פ."] || "").trim() || null,
        email: (row["אימייל"] || "").trim() || null,
        address: (row["כתובת"] || "").trim() || null,
        notes: (row["הערות"] || "").trim() || null
      });
    });

    let created = 0;
    if (toCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        const result = await tx.client.createMany({ data: toCreate });
        created = result.count;
        await logAudit(tx, {
          entityType: AuditEntity.CLIENT,
          entityId: "BULK_IMPORT",
          action: AuditAction.CREATE,
          newValue: {
            event: "csv_import",
            created,
            skipped,
            errorCount: errors.length,
            sampleNames: toCreate.slice(0, 5).map((c) => c.companyName)
          },
          userId: me.id
        });
      });
      revalidatePath("/clients");
    }

    return { ok: true, error: null, created, skipped, errors };
  } catch (e) {
    return {
      ...EMPTY_IMPORT_RESULT,
      error: e instanceof Error ? e.message : "שגיאה בייבוא"
    };
  }
}

// ============================================================================
// TASK TEMPLATES (scoped to a specific authority + building type combo)
// ============================================================================

// New columns appended at the end keep older exported files compatible with
// the importer (missing trailing columns = null / empty array).
const TEMPLATE_HEADERS = [
  "שם תבנית",
  "תיאור",
  "משך ימים",
  "סדר",
  "פעיל",
  "קטגוריה",
  "אחריות",
  "תגיות",
  "אחראי ב״מ - אימייל"
];

export async function exportTaskTemplatesCsv(
  authorityId: string,
  buildingTypeId: string
): Promise<ExportResult> {
  try {
    await requireRole(["ADMIN"]);
    if (!authorityId || !buildingTypeId) {
      return {
        ok: false,
        error: "יש לבחור רשות וסוג בניין",
        csv: "",
        filename: ""
      };
    }
    const [templates, authority, buildingType] = await Promise.all([
      prisma.taskTemplate.findMany({
        where: { authorityId, buildingTypeId },
        include: { defaultAssignee: { select: { email: true } } },
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }]
      }),
      prisma.authority.findUnique({
        where: { id: authorityId },
        select: { name: true }
      }),
      prisma.buildingType.findUnique({
        where: { id: buildingTypeId },
        select: { name: true }
      })
    ]);
    if (!authority || !buildingType) {
      return {
        ok: false,
        error: "רשות או סוג בניין לא נמצאו",
        csv: "",
        filename: ""
      };
    }
    const rows = templates.map((t) => [
      t.name,
      t.description ?? "",
      t.defaultDurationDays !== null ? String(t.defaultDurationDays) : "",
      String(t.orderIndex),
      t.isActive ? "כן" : "לא",
      t.category ?? "",
      t.responsibility ? TASK_RESPONSIBILITY_LABEL[t.responsibility] : "",
      t.tags.join("|"),
      t.defaultAssignee?.email ?? ""
    ]);
    return {
      ok: true,
      error: null,
      csv: buildCsv(TEMPLATE_HEADERS, rows),
      filename: `templates_${safeFileSegment(authority.name)}_${safeFileSegment(buildingType.name)}_${todayStamp()}.csv`
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      csv: "",
      filename: ""
    };
  }
}

export async function importTaskTemplatesCsv(
  formData: FormData
): Promise<ImportResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const authorityId = String(formData.get("authorityId") || "");
    const buildingTypeId = String(formData.get("buildingTypeId") || "");
    if (!authorityId || !buildingTypeId) {
      return { ...EMPTY_IMPORT_RESULT, error: "חסר רשות / סוג בניין" };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "יש לבחור קובץ CSV" };
    }
    const parsed = rowsToObjects(parseCsv(await fileToText(file)));
    if (!parsed || parsed.data.length === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "הקובץ ריק או לא תקין" };
    }

    const errors: { row: number; message: string }[] = [];
    const toCreate: Array<{
      authorityId: string;
      buildingTypeId: string;
      name: string;
      description: string | null;
      defaultDurationDays: number | null;
      orderIndex: number;
      isActive: boolean;
      category: string | null;
      responsibility: TaskResponsibility | null;
      tags: string[];
      defaultAssigneeId: string | null;
    }> = [];

    const existing = await prisma.taskTemplate.findMany({
      where: { authorityId, buildingTypeId },
      select: { name: true }
    });
    const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
    const seenInThisFile = new Set<string>();
    let skipped = 0;

    // Bulk-resolve default assignee emails up front so we don't issue a User
    // query per row. Only ADMIN/EMPLOYEE may be a default assignee.
    const emailsInFile = new Set<string>();
    parsed.data.forEach((row) => {
      const e = (row["אחראי ב״מ - אימייל"] || "").trim().toLowerCase();
      if (e) emailsInFile.add(e);
    });
    let emailToUserId = new Map<string, string>();
    if (emailsInFile.size > 0) {
      const users = await prisma.user.findMany({
        where: {
          email: { in: Array.from(emailsInFile), mode: "insensitive" },
          isActive: true,
          role: { in: ["ADMIN", "EMPLOYEE"] }
        },
        select: { id: true, email: true }
      });
      emailToUserId = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    }

    parsed.data.forEach((row, idx) => {
      const lineNum = idx + 2;
      const name = (row["שם תבנית"] || "").trim();
      if (!name) {
        errors.push({ row: lineNum, message: "חסר שם תבנית" });
        return;
      }
      const key = name.toLowerCase();
      if (existingNames.has(key) || seenInThisFile.has(key)) {
        skipped++;
        return;
      }
      const durationRaw = (row["משך ימים"] || "").trim();
      let defaultDurationDays: number | null = null;
      if (durationRaw) {
        const n = Number(durationRaw);
        if (!Number.isFinite(n) || n < 0) {
          errors.push({ row: lineNum, message: `משך ימים לא חוקי: ${durationRaw}` });
          return;
        }
        defaultDurationDays = Math.floor(n);
      }
      const orderRaw = (row["סדר"] || "").trim();
      let orderIndex = 0;
      if (orderRaw) {
        const n = Number(orderRaw);
        if (!Number.isFinite(n)) {
          errors.push({ row: lineNum, message: `סדר לא חוקי: ${orderRaw}` });
          return;
        }
        orderIndex = Math.floor(n);
      }
      const activeRaw = (row["פעיל"] || "").trim().toLowerCase();
      // Blank defaults to active. Accepts כן / true / 1 as truthy,
      // לא / false / 0 as falsy; anything else falls back to active.
      const isActive =
        activeRaw === "" ||
        activeRaw === "כן" ||
        activeRaw === "true" ||
        activeRaw === "1";

      const category = (row["קטגוריה"] || "").trim() || null;
      const responsibilityRaw = (row["אחריות"] || "").trim();
      let responsibility: TaskResponsibility | null = null;
      if (responsibilityRaw) {
        const mapped = TASK_RESPONSIBILITY_HE_TO_ENUM[responsibilityRaw];
        if (!mapped) {
          errors.push({ row: lineNum, message: `אחריות לא חוקית: ${responsibilityRaw}` });
          return;
        }
        responsibility = mapped;
      }
      const tags = parseTagsCell(row["תגיות"] || "");

      const defaultEmail = (row["אחראי ב״מ - אימייל"] || "")
        .trim()
        .toLowerCase();
      let defaultAssigneeId: string | null = null;
      if (defaultEmail) {
        const id = emailToUserId.get(defaultEmail);
        if (!id) {
          errors.push({
            row: lineNum,
            message: `משתמש ברירת מחדל לא נמצא או לא פעיל: ${defaultEmail}`
          });
          return;
        }
        defaultAssigneeId = id;
      }

      seenInThisFile.add(key);
      toCreate.push({
        authorityId,
        buildingTypeId,
        name,
        description: (row["תיאור"] || "").trim() || null,
        defaultDurationDays,
        orderIndex,
        isActive,
        category,
        responsibility,
        tags,
        defaultAssigneeId
      });
    });

    let created = 0;
    if (toCreate.length > 0) {
      try {
        await prisma.$transaction(async (tx) => {
          const result = await tx.taskTemplate.createMany({ data: toCreate });
          created = result.count;
          await logAudit(tx, {
            entityType: AuditEntity.TASK_TEMPLATE,
            entityId: `${authorityId}:${buildingTypeId}`,
            action: AuditAction.CREATE,
            newValue: {
              event: "csv_import",
              authorityId,
              buildingTypeId,
              created,
              skipped,
              errorCount: errors.length,
              sampleNames: toCreate.slice(0, 5).map((t) => t.name)
            },
            userId: me.id
          });
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          return {
            ...EMPTY_IMPORT_RESULT,
            error:
              "התנגשות שמות — לפחות שורה אחת חוזרת על תבנית קיימת בצירוף הזה"
          };
        }
        throw e;
      }
      revalidatePath("/settings/templates");
    }

    return { ok: true, error: null, created, skipped, errors };
  } catch (e) {
    return {
      ...EMPTY_IMPORT_RESULT,
      error: e instanceof Error ? e.message : "שגיאה בייבוא"
    };
  }
}

// ============================================================================
// PERMIT TASKS (scoped to a specific permit)
// ============================================================================

// Trailing 3 columns are optional in import (older exports without them still parse).
const TASK_HEADERS = [
  "שם המשימה",
  "תיאור",
  "סטטוס",
  "עדיפות",
  "תאריך יעד",
  "אחראי-אימייל",
  "קטגוריה",
  "אחריות",
  "תגיות"
];

const STATUS_HE_TO_ENUM: Record<string, TaskStatus> = {
  פתוח: "OPEN",
  בתהליך: "IN_PROGRESS",
  "ממתין לרשות": "AWAITING_AUTHORITY",
  הושלם: "COMPLETED",
  חסום: "BLOCKED"
};
const STATUS_ENUM_TO_HE: Record<TaskStatus, string> = {
  OPEN: "פתוח",
  IN_PROGRESS: "בתהליך",
  AWAITING_AUTHORITY: "ממתין לרשות",
  COMPLETED: "הושלם",
  BLOCKED: "חסום"
};
const PRIORITY_HE_TO_ENUM: Record<string, TaskPriority> = {
  רגיל: "NORMAL",
  דחוף: "URGENT"
};
const PRIORITY_ENUM_TO_HE: Record<TaskPriority, string> = {
  NORMAL: "רגיל",
  URGENT: "דחוף"
};

export async function exportPermitTasksCsv(
  permitId: string
): Promise<ExportResult> {
  try {
    // Employees see and operate the permit tasks tab, so they can also
    // export. Only the write path is admin-only.
    await requireRole(["ADMIN", "EMPLOYEE"]);
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true, name: true }
    });
    if (!permit) {
      return { ok: false, error: "ההיתר לא נמצא", csv: "", filename: "" };
    }
    const tasks = await prisma.task.findMany({
      where: { permitId, deletedAt: null },
      include: { assignee: { select: { email: true } } },
      orderBy: [{ isSpotlight: "desc" }, { priority: "desc" }, { dueDate: "asc" }]
    });
    const rows = tasks.map((t) => [
      t.name,
      t.description ?? "",
      STATUS_ENUM_TO_HE[t.status],
      PRIORITY_ENUM_TO_HE[t.priority],
      formatDateForCsv(t.dueDate),
      t.assignee?.email ?? "",
      t.category ?? "",
      t.responsibility ? TASK_RESPONSIBILITY_LABEL[t.responsibility] : "",
      t.tags.join("|")
    ]);
    return {
      ok: true,
      error: null,
      csv: buildCsv(TASK_HEADERS, rows),
      filename: `tasks_${safeFileSegment(permit.name)}_${todayStamp()}.csv`
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      csv: "",
      filename: ""
    };
  }
}

export async function importPermitTasksCsv(
  formData: FormData
): Promise<ImportResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const permitId = String(formData.get("permitId") || "");
    if (!permitId) {
      return { ...EMPTY_IMPORT_RESULT, error: "חסר מזהה היתר" };
    }
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true }
    });
    if (!permit) {
      return { ...EMPTY_IMPORT_RESULT, error: "ההיתר לא נמצא" };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "יש לבחור קובץ CSV" };
    }
    const parsed = rowsToObjects(parseCsv(await fileToText(file)));
    if (!parsed || parsed.data.length === 0) {
      return { ...EMPTY_IMPORT_RESULT, error: "הקובץ ריק או לא תקין" };
    }

    const errors: { row: number; message: string }[] = [];
    type TaskRow = {
      permitId: string;
      name: string;
      description: string | null;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: Date | null;
      assigneeId: string | null;
      frozen: boolean;
      category: string | null;
      responsibility: TaskResponsibility | null;
      tags: string[];
    };
    const toCreate: TaskRow[] = [];

    // Bulk-resolve assignee emails up front so we don't issue one User
    // query per row.
    const emailsInFile = new Set<string>();
    parsed.data.forEach((row) => {
      const e = (row["אחראי-אימייל"] || "").trim().toLowerCase();
      if (e) emailsInFile.add(e);
    });
    let emailToUserId = new Map<string, string>();
    if (emailsInFile.size > 0) {
      const users = await prisma.user.findMany({
        where: {
          email: { in: Array.from(emailsInFile), mode: "insensitive" },
          isActive: true
        },
        select: { id: true, email: true }
      });
      emailToUserId = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));
    }

    parsed.data.forEach((row, idx) => {
      const lineNum = idx + 2;
      const name = (row["שם המשימה"] || "").trim();
      if (!name) {
        errors.push({ row: lineNum, message: "חסר שם משימה" });
        return;
      }
      const statusRaw = (row["סטטוס"] || "").trim();
      let status: TaskStatus = "OPEN";
      if (statusRaw) {
        const mapped = STATUS_HE_TO_ENUM[statusRaw];
        if (!mapped) {
          errors.push({ row: lineNum, message: `סטטוס לא חוקי: ${statusRaw}` });
          return;
        }
        status = mapped;
      }
      const priorityRaw = (row["עדיפות"] || "").trim();
      let priority: TaskPriority = "NORMAL";
      if (priorityRaw) {
        const mapped = PRIORITY_HE_TO_ENUM[priorityRaw];
        if (!mapped) {
          errors.push({ row: lineNum, message: `עדיפות לא חוקית: ${priorityRaw}` });
          return;
        }
        priority = mapped;
      }
      const dueRaw = (row["תאריך יעד"] || "").trim();
      let dueDate: Date | null = null;
      if (dueRaw) {
        dueDate = parseFlexibleDate(dueRaw);
        if (!dueDate) {
          errors.push({ row: lineNum, message: `תאריך יעד לא חוקי: ${dueRaw}` });
          return;
        }
      }
      const assigneeEmail = (row["אחראי-אימייל"] || "").trim().toLowerCase();
      let assigneeId: string | null = null;
      if (assigneeEmail) {
        const id = emailToUserId.get(assigneeEmail);
        if (!id) {
          errors.push({ row: lineNum, message: `משתמש לא נמצא: ${assigneeEmail}` });
          return;
        }
        assigneeId = id;
      }
      const category = (row["קטגוריה"] || "").trim() || null;
      const responsibilityRaw = (row["אחריות"] || "").trim();
      let responsibility: TaskResponsibility | null = null;
      if (responsibilityRaw) {
        const mapped = TASK_RESPONSIBILITY_HE_TO_ENUM[responsibilityRaw];
        if (!mapped) {
          errors.push({ row: lineNum, message: `אחריות לא חוקית: ${responsibilityRaw}` });
          return;
        }
        responsibility = mapped;
      }
      const tags = parseTagsCell(row["תגיות"] || "");

      toCreate.push({
        permitId,
        name,
        description: (row["תיאור"] || "").trim() || null,
        status,
        priority,
        dueDate,
        assigneeId,
        // Match the runtime rule: AWAITING_AUTHORITY pairs with frozen=true.
        frozen: status === "AWAITING_AUTHORITY",
        category,
        responsibility,
        tags
      });
    });

    let created = 0;
    if (toCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        const result = await tx.task.createMany({ data: toCreate });
        created = result.count;
        // Audit against the parent permit, matching the precedent set
        // by createProject's tasks_generated_from_templates entry.
        await logAudit(tx, {
          entityType: AuditEntity.PERMIT,
          entityId: permitId,
          action: AuditAction.UPDATE,
          newValue: {
            event: "tasks_csv_imported",
            created,
            errorCount: errors.length,
            sampleNames: toCreate.slice(0, 5).map((t) => t.name)
          },
          userId: me.id
        });
      });
      revalidatePath(`/permits/${permitId}`, "layout");
      revalidatePath("/tasks");
    }

    return { ok: true, error: null, created, skipped: 0, errors };
  } catch (e) {
    return {
      ...EMPTY_IMPORT_RESULT,
      error: e instanceof Error ? e.message : "שגיאה בייבוא"
    };
  }
}
