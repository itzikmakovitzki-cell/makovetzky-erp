// One-shot import: Hana Rovina 11 (Rishon LeZion) tasks file.
//
// The customer's xlsx (חנה רובינא 11 טבלת סטטוס) has three quirks that broke
// the in-app Block-21 importer:
//   1. A duplicate "דרישות / פירוט / סטאטוס" header row mid-data.
//   2. Single-cell rows used as visual category bands ("טפסים", "תאגיד- מני\"ב",
//      "אישורי מחלקות", "דרישות נוספות") — the plain importer treats these as
//      tasks with no description and status=OPEN.
//   3. A status of "ירד בדרישות" (= dropped from the authority requirements) on
//      a few rows. These shouldn't become tasks at all.
//
// This script parses with band-awareness, skips dropped rows, prefixes every
// task with [category] so it round-trips back to a properly grouped export
// (lib/xlsx.ts extractCategory), and writes:
//   - real Tasks on the Hana Rovina permit
//   - TaskTemplates for עיריית ראשון לציון × וילה פרטית (skips duplicates via
//     the unique (authorityId, buildingTypeId, name) constraint)
//
// Usage:  npx tsx scripts/import-hana-rovina.ts            # commit
//         npx tsx scripts/import-hana-rovina.ts --dry-run  # preview only

import * as XLSX from "xlsx";
import * as fs from "fs";
import { PrismaClient, type TaskStatus, AuditAction } from "@prisma/client";
import { mapHebrewStatusToEnum } from "../lib/xlsx";

const prisma = new PrismaClient();

const XLSX_PATH =
  "C:\\Users\\itzik\\AppData\\Local\\Temp\\חנה רובינא 11 טבלת סטטוס (1).xlsx";

// Resolved earlier via Supabase MCP.
const PERMIT_ID = "cmpv21ir20001jr04inksykah";
const AUTHORITY_ID = "cmp6o7cgm0000tp54rn3zdf9m"; // עיריית ראשון לציון
const BUILDING_TYPE_ID = "cmp463mg60009tpes5kxnt2em"; // וילה פרטית

const HEADER_REQ = "דרישות";
const HEADER_DETAIL = "פירוט";
const HEADER_STATUS = "סטאטוס";
const HEADER_STATUS_ALT = "סטטוס";

const DROPPED = "ירד בדרישות";

// The customer marks categories visually (bold + merged cells in their
// original template). After conversion to a flat CSV/XLSX those styling
// hints are gone — a category row is *structurally identical* to a
// single-column task row. So we recognise the five known categories by
// exact text and treat everything else as a task.
const CATEGORY_NAMES = new Set<string>([
  "טפסים",
  "בדיקות מעבדה ואישורים נדרשים",
  'תאגיד- מני"ב',
  "אישורי מחלקות",
  "דרישות נוספות"
]);

type ParsedRow = {
  sourceRow: number;
  category: string;
  name: string;
  description: string | null;
  rawStatus: string;
};

// --- Parser ---------------------------------------------------------------

function readSheet(): {
  rows: ParsedRow[];
  skipped: { row: number; reason: string }[];
} {
  const bytes = fs.readFileSync(XLSX_PATH);
  const wb = XLSX.read(bytes, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet["!ref"]) throw new Error("Empty sheet");
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  // Find FIRST header row.
  let headerRow = -1;
  let reqCol = -1;
  let detailCol = -1;
  let statusCol = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = String(
        sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? ""
      ).trim();
      if (v === HEADER_REQ) {
        reqCol = c;
        // Same row: find the other two.
        for (let c2 = range.s.c; c2 <= range.e.c; c2++) {
          const v2 = String(
            sheet[XLSX.utils.encode_cell({ r, c: c2 })]?.v ?? ""
          ).trim();
          if (v2 === HEADER_DETAIL) detailCol = c2;
          if (v2 === HEADER_STATUS || v2 === HEADER_STATUS_ALT) statusCol = c2;
        }
        if (detailCol >= 0 && statusCol >= 0) headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) {
    throw new Error('No "דרישות" header found.');
  }

  const out: ParsedRow[] = [];
  const skipped: { row: number; reason: string }[] = [];
  // Scan rows ABOVE the header for the first category — the customer's
  // template puts the opening category ("טפסים") above the header row.
  let currentCategory = "כללי";
  for (let r = range.s.r; r < headerRow; r++) {
    const v = String(
      sheet[XLSX.utils.encode_cell({ r, c: reqCol })]?.v ?? ""
    ).trim();
    if (CATEGORY_NAMES.has(v)) {
      currentCategory = v;
    }
  }

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const req = String(
      sheet[XLSX.utils.encode_cell({ r, c: reqCol })]?.v ?? ""
    ).trim();
    const detail = String(
      sheet[XLSX.utils.encode_cell({ r, c: detailCol })]?.v ?? ""
    ).trim();
    const status = String(
      sheet[XLSX.utils.encode_cell({ r, c: statusCol })]?.v ?? ""
    ).trim();

    // Fully blank → skip silently.
    if (!req && !detail && !status) continue;

    // Duplicate header row mid-data → ignore.
    if (
      req === HEADER_REQ &&
      detail === HEADER_DETAIL &&
      (status === HEADER_STATUS || status === HEADER_STATUS_ALT)
    ) {
      continue;
    }

    // Category band: only the first col is filled AND the text matches one of
    // the known category names. Other single-col rows are genuine tasks (the
    // file uses the same shape for both kinds of rows).
    if (req && !detail && !status && CATEGORY_NAMES.has(req)) {
      currentCategory = req;
      continue;
    }

    // Dropped from requirements → not a task.
    if (status === DROPPED) {
      skipped.push({ row: r + 1, reason: 'סטאטוס "ירד בדרישות" — מדולג' });
      continue;
    }

    // Standard row.
    let name: string;
    let description: string | null;
    if (req && detail) {
      name = req;
      description = detail;
    } else if (req) {
      name = req;
      description = null;
    } else {
      // Sub-stage: detail carries the line item.
      name = detail;
      description = null;
    }

    out.push({
      sourceRow: r + 1,
      category: currentCategory,
      name,
      description,
      rawStatus: status
    });
  }

  return { rows: out, skipped };
}

// --- Status / description normalisation -----------------------------------

function resolveStatus(rawStatus: string, baseDescription: string | null): {
  status: TaskStatus;
  description: string | null;
  frozen: boolean;
} {
  let status: TaskStatus = "OPEN";
  let description = baseDescription;

  if (rawStatus) {
    const mapped = mapHebrewStatusToEnum(rawStatus);
    if (mapped) {
      status = mapped;
    } else {
      const note = `[סטאטוס: ${rawStatus}]`;
      description = description ? `${description}\n${note}` : note;
    }
  }
  return {
    status,
    description,
    frozen: status === "AWAITING_AUTHORITY"
  };
}

// --- Main -----------------------------------------------------------------

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { rows, skipped } = readSheet();

  console.log(`\n=== Parse summary ===`);
  console.log(`  total rows parsed: ${rows.length}`);
  console.log(`  skipped: ${skipped.length}`);
  for (const s of skipped) console.log(`    - R${s.row}: ${s.reason}`);

  // Group preview by category.
  const byCat = new Map<string, ParsedRow[]>();
  for (const r of rows) {
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }
  console.log(`\n=== Preview by category ===`);
  for (const [cat, items] of byCat) {
    console.log(`  [${cat}]  (${items.length})`);
    for (const it of items.slice(0, 3)) {
      console.log(
        `    R${it.sourceRow}  ${it.name.slice(0, 50)}${it.description ? ` — ${it.description.slice(0, 30)}` : ""}${it.rawStatus ? ` [${it.rawStatus.slice(0, 20)}]` : ""}`
      );
    }
    if (items.length > 3) console.log(`    …`);
  }

  if (dryRun) {
    console.log("\n(dry-run — no DB writes)\n");
    return;
  }

  // -- Resolve seeding admin for audit log --
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    select: { id: true }
  });
  if (!admin) throw new Error("No active ADMIN user to attribute audit rows to.");

  // -- Existing tasks (dedupe by exact prefixed name) --
  const existingTaskNames = new Set(
    (
      await prisma.task.findMany({
        where: { permitId: PERMIT_ID, deletedAt: null },
        select: { name: true }
      })
    ).map((t) => t.name)
  );

  // -- Existing templates for this authority+buildingType --
  const existingTemplateNames = new Set(
    (
      await prisma.taskTemplate.findMany({
        where: {
          authorityId: AUTHORITY_ID,
          buildingTypeId: BUILDING_TYPE_ID
        },
        select: { name: true }
      })
    ).map((t) => t.name)
  );

  // -- Highest existing orderIndex so we append, not collide --
  const maxOrder = await prisma.taskTemplate.aggregate({
    where: {
      authorityId: AUTHORITY_ID,
      buildingTypeId: BUILDING_TYPE_ID
    },
    _max: { orderIndex: true }
  });
  let nextOrderIndex = (maxOrder._max.orderIndex ?? 0) + 1;

  const taskRows: Array<{
    permitId: string;
    name: string;
    description: string | null;
    status: TaskStatus;
    frozen: boolean;
  }> = [];
  const templateRows: Array<{
    authorityId: string;
    buildingTypeId: string;
    name: string;
    description: string | null;
    defaultDurationDays: number;
    orderIndex: number;
    isActive: boolean;
  }> = [];

  let taskDupes = 0;
  let templateDupes = 0;

  for (const r of rows) {
    const prefixedName = `[${r.category}] ${r.name}`.trim();
    const { status, description, frozen } = resolveStatus(
      r.rawStatus,
      r.description
    );

    if (existingTaskNames.has(prefixedName)) {
      taskDupes++;
    } else {
      taskRows.push({
        permitId: PERMIT_ID,
        name: prefixedName,
        description,
        status,
        frozen
      });
      existingTaskNames.add(prefixedName);
    }

    // Templates: clean (no status — status is per-permit), description from
    // detail only.
    if (existingTemplateNames.has(prefixedName)) {
      templateDupes++;
    } else {
      templateRows.push({
        authorityId: AUTHORITY_ID,
        buildingTypeId: BUILDING_TYPE_ID,
        name: prefixedName,
        description: r.description,
        defaultDurationDays: 14,
        orderIndex: nextOrderIndex++,
        isActive: true
      });
      existingTemplateNames.add(prefixedName);
    }
  }

  console.log(`\n=== About to write ===`);
  console.log(`  Tasks → Hana Rovina permit:`);
  console.log(`    insert: ${taskRows.length} · already-exist (skipped): ${taskDupes}`);
  console.log(`  Templates → Rishon LeZion × Private Villa:`);
  console.log(`    insert: ${templateRows.length} · already-exist (skipped): ${templateDupes}`);

  await prisma.$transaction(async (tx) => {
    if (taskRows.length > 0) {
      const r = await tx.task.createMany({ data: taskRows });
      console.log(`  ✓ created ${r.count} tasks`);
      await tx.auditLog.create({
        data: {
          entityType: "PERMIT",
          entityId: PERMIT_ID,
          action: AuditAction.UPDATE,
          newValue: {
            event: "tasks_xlsx_imported",
            source: "scripts/import-hana-rovina.ts",
            created: r.count,
            sampleNames: taskRows.slice(0, 5).map((t) => t.name)
          },
          userId: admin.id
        }
      });
    }
    if (templateRows.length > 0) {
      const r = await tx.taskTemplate.createMany({
        data: templateRows,
        skipDuplicates: true
      });
      console.log(`  ✓ created ${r.count} templates`);
      await tx.auditLog.create({
        data: {
          entityType: "TASK_TEMPLATE",
          entityId: `${AUTHORITY_ID}:${BUILDING_TYPE_ID}`,
          action: AuditAction.CREATE,
          newValue: {
            event: "templates_seeded_from_hana_rovina_xlsx",
            authorityId: AUTHORITY_ID,
            buildingTypeId: BUILDING_TYPE_ID,
            created: r.count,
            sampleNames: templateRows.slice(0, 5).map((t) => t.name)
          },
          userId: admin.id
        }
      });
    }
  });

  console.log("\nDone.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
