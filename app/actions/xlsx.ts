"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import {
  buildMakovetzkiWorkbook,
  EMPTY_XLSX_IMPORT_RESULT,
  mapHebrewStatusToEnum,
  parseMakovetzkiWorkbook,
  TASK_STATUS_TO_MAKOVETZKI_HE,
  type XlsxExportResult,
  type XlsxImportResult
} from "@/lib/xlsx";
import { safeFileSegment, todayStamp } from "@/lib/csv";

// Block 21: Makovetzki-format .xlsx I/O for the per-permit tasks tab.
// Replaces the old CSV import/export for this surface specifically; CSV
// elsewhere (clients, templates) is unchanged.

export async function exportPermitTasksXlsx(
  permitId: string
): Promise<XlsxExportResult> {
  try {
    // Same RBAC contract as the CSV predecessor — employees view the tab,
    // so they can export.
    await requireRole(["ADMIN", "EMPLOYEE"]);
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true, name: true }
    });
    if (!permit) {
      return { ok: false, error: "ההיתר לא נמצא", base64: "", filename: "" };
    }
    const tasks = await prisma.task.findMany({
      where: { permitId, deletedAt: null },
      orderBy: [
        { isSpotlight: "desc" },
        { priority: "desc" },
        { dueDate: "asc" }
      ]
    });
    const rows = tasks.map((t) => ({
      requirement: t.name,
      detail: t.description ?? "",
      status: TASK_STATUS_TO_MAKOVETZKI_HE[t.status]
    }));
    const title = `טופס 4 / תעודת גמר - ${permit.name}`;
    const base64 = await buildMakovetzkiWorkbook(title, rows);
    return {
      ok: true,
      error: null,
      base64,
      filename: `makovetzki_${safeFileSegment(permit.name)}_${todayStamp()}.xlsx`
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בייצוא",
      base64: "",
      filename: ""
    };
  }
}

export async function importPermitTasksXlsx(
  formData: FormData
): Promise<XlsxImportResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const permitId = String(formData.get("permitId") || "");
    if (!permitId) {
      return { ...EMPTY_XLSX_IMPORT_RESULT, error: "חסר מזהה היתר" };
    }
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true }
    });
    if (!permit) {
      return { ...EMPTY_XLSX_IMPORT_RESULT, error: "ההיתר לא נמצא" };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { ...EMPTY_XLSX_IMPORT_RESULT, error: "יש לבחור קובץ אקסל" };
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseMakovetzkiWorkbook(bytes);
    if (!parsed.ok) {
      return { ...EMPTY_XLSX_IMPORT_RESULT, error: parsed.error };
    }
    if (parsed.rows.length === 0) {
      return {
        ...EMPTY_XLSX_IMPORT_RESULT,
        error: "לא נמצאו שורות נתונים מתחת לכותרת"
      };
    }

    const errors: { row: number; message: string }[] = [];
    type TaskRow = {
      permitId: string;
      name: string;
      description: string | null;
      status: TaskStatus;
      frozen: boolean;
    };
    const toCreate: TaskRow[] = [];

    for (const r of parsed.rows) {
      if (!r.name) {
        errors.push({
          row: r.sourceRow,
          message: 'חסר ערך בעמודות "דרישות" ו"פירוט"'
        });
        continue;
      }
      let status: TaskStatus = "OPEN";
      let description = r.description;
      if (r.rawStatus) {
        const mapped = mapHebrewStatusToEnum(r.rawStatus);
        if (mapped) {
          status = mapped;
        } else {
          // Unknown status label — preserve the raw text inside the
          // description so nothing is silently lost.
          const note = `[סטאטוס: ${r.rawStatus}]`;
          description = description ? `${description}\n${note}` : note;
        }
      }
      toCreate.push({
        permitId,
        name: r.name,
        description,
        status,
        // Same rule used by CSV import + task creation runtime: a task
        // marked AWAITING_AUTHORITY is treated as frozen.
        frozen: status === "AWAITING_AUTHORITY"
      });
    }

    let created = 0;
    if (toCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        const result = await tx.task.createMany({ data: toCreate });
        created = result.count;
        await logAudit(tx, {
          entityType: AuditEntity.PERMIT,
          entityId: permitId,
          action: AuditAction.UPDATE,
          newValue: {
            event: "tasks_xlsx_imported",
            format: "makovetzki",
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
      ...EMPTY_XLSX_IMPORT_RESULT,
      error: e instanceof Error ? e.message : "שגיאה בייבוא"
    };
  }
}
