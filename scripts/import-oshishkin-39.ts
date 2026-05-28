/**
 * One-shot import: Form 4 / Certificate of Completion for Ushishkin 39 Rishon LeZion.
 * Run with `--dry-run` to preview without writing. Run without flag to execute.
 *
 *   npx tsx scripts/import-oshishkin-39.ts --dry-run
 *   npx tsx scripts/import-oshishkin-39.ts
 */

import { PrismaClient, Prisma, TaskStatus, AuditAction } from "@prisma/client";
import { AuditEntity, logAudit } from "../lib/audit";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

const CLIENT_NAME = "בסיס הנדסה";
const MASTER_DEAL_NAME = "ראשון לציון מגדל מגורים — אוסישקין 39";
const AUTHORITY_NAME = "עיריית ראשון לציון";
const BUILDING_TYPE_NAME = "מגדל מגורים";
const PERMIT_NAME = "טופס 4 / תעודת גמר — אוסישקין 39";
const PERMIT_DEADLINE = new Date("2025-12-31T00:00:00Z");

type Row = {
  section: string;
  name: string;
  description?: string;
  status: TaskStatus;
};

// Status notes from the source file are preserved in description so history isn't lost.
const ROWS: Row[] = [
  // === Section 1: Forms and declarations ===
  {
    section: "טפסים",
    name: "דיווח על עריכת ביקורת באתר — סימון קווי בניין",
    description: "שילר חתם לרשום כללי. כל הטפסים בטיפול בת אור + סיגל 11/12.",
    status: "IN_PROGRESS"
  },
  {
    section: "טפסים",
    name: "דיווח על עריכת ביקורת באתר — גמר יסודות",
    description: "שילר חתם לרשום כללי. כל הטפסים בטיפול בת אור + סיגל 11/12.",
    status: "IN_PROGRESS"
  },
  {
    section: "טפסים",
    name: "דיווח על עריכת ביקורת באתר — גמר שלד",
    description: "שילר חתם לרשום כללי. כל הטפסים בטיפול בת אור + סיגל 11/12.",
    status: "IN_PROGRESS"
  },
  {
    section: "טפסים",
    name: "דיווח על עריכת ביקורת באתר — גמר בניין",
    description: "שילר חתם לרשום כללי. כל הטפסים בטיפול בת אור + סיגל 11/12.",
    status: "IN_PROGRESS"
  },
  { section: "טפסים", name: "תצהיר האחראי לביצוע שלד כולל קירות תומכים", description: "התקבל.", status: "COMPLETED" },
  { section: "טפסים", name: "תצהיר המהנדס על ביצוע עבודות הממד/מקלט", description: "התקבל.", status: "COMPLETED" },
  { section: "טפסים", name: "תצהיר מהנדס על ביצוע חיפוי קירות", description: "התקבל.", status: "COMPLETED" },
  { section: "טפסים", name: "הודעת מתכנן השלד בדבר תכנית קונסטרוקציה של המבנה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "טפסים",
    name: "תצהיר האחראי לתכנון וביצוע מערכות מים, ביוב, משאבות, שטיפה וחיטוי, מערכת סולארית",
    description: "התקבל.",
    status: "COMPLETED"
  },
  { section: "טפסים", name: "אישור קבלן רשום על ביצוע עבודות בניה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "טפסים",
    name: "טופס בקשה לתעודת גמר",
    description: "יזם + א.ביקורת + קונס נחתם — נשלח למרוואן לחתימה אשלד 22/12.",
    status: "IN_PROGRESS"
  },

  // === Section 2: Lab tests and required certificates ===
  { section: "בדיקות מעבדה", name: "דוח מסכם ריכוז בטונים", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח מסכם ריכוז אינסטלציה", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח מסכם מערכת סולארית", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח מסכם מערכת משאבות — הגברת לחץ מים", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח מסכם חיטוי ומז\"ח", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת המטרת קירות", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת הצפת גגות ומרפסות", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת חיפוי קירות", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת אטימות של הממד/מקלט", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת טיח פנים של הממד/מקלט", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "דוח בדיקת מערכת הגז", description: "התקבל.", status: "COMPLETED" },
  { section: "בדיקות מעבדה", name: "תסקיר מעלית של מכון תקנים", status: "OPEN" },
  {
    section: "בדיקות מעבדה",
    name: "אישור על ביצוע תשתיות חברת בזק/הוט",
    description: "בטיפול בשבועות הקרובים 11/12. איש קשר בזק 0506778005, הוט 0536064972.",
    status: "IN_PROGRESS"
  },

  // === Section 3: HGA (Civil Defense) ===
  { section: "הג\"א", name: "תוכנית הג\"א מאושרת וחתומה בקובץ SIGNED", description: "התקבל. אישור הג\"א התקבל בהצלחה 10/11/25.", status: "COMPLETED" },
  { section: "הג\"א", name: "ריכוז בטונים", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "בדיקת טיח", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "ריכוז בדיקות אטימות", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "אישור מסננים + תו תקן", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "אישור מסגרות + תו תקן", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "תצהיר אחראי ביצוע שלד — א'20", description: "התקבל.", status: "COMPLETED" },
  { section: "הג\"א", name: "תמונות ממדים (10% מכלל הדירות)", description: "התקבל.", status: "COMPLETED" },

  // === Section 4: Fire safety — consultant declarations ===
  {
    section: "כיבוי אש — הצהרות",
    name: "הצהרת עורך בקשה כי המבנה נבנה לפי חוק תכנון ובניה",
    status: "OPEN"
  },
  {
    section: "כיבוי אש — הצהרות",
    name: "הצהרת קונסטרוקטור על עמידות שלד המבנה",
    description: "נשלח במייל ליזהר + עבד 16/11.",
    status: "IN_PROGRESS"
  },
  { section: "כיבוי אש — הצהרות", name: "הצהרת יועץ בטיחות", description: "לאחר ביקורת בשטח.", status: "OPEN" },
  {
    section: "כיבוי אש — הצהרות",
    name: "הצהרת מהנדס חשמל (חוק החשמל 1954)",
    description: "לאחר סיום עבודות.",
    status: "OPEN"
  },
  { section: "כיבוי אש — הצהרות", name: "הצהרת קבלן חשמל", description: "לאחר סיום עבודות.", status: "OPEN" },
  { section: "כיבוי אש — הצהרות", name: "הצהרת מהנדס מיזוג אויר", description: "לאחר סיום עבודות.", status: "OPEN" },
  { section: "כיבוי אש — הצהרות", name: "טופס א-2 חתום ע\"י כל היועצים", description: "טופס א2 נחתם.", status: "COMPLETED" },

  // === Section 5: Fire safety — tests and approvals (file 240384-1, opened 28/12) ===
  { section: "כיבוי אש — בדיקות", name: "התחייבות יזם/קבלן למסירת ציוד כיבוי", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "טופס הוספת איש קשר חתום ע\"י מייפה הכוח", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "אישור יצרן לוחות חשמל", description: "באחריות קבלן חשמל.", status: "IN_PROGRESS" },
  { section: "כיבוי אש — בדיקות", name: "ת\"י 921 חומרי גמר + מסתורי כביסה", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "ת\"י 931 — איטום מעברים — מכון מורשה", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "אישור איטום מעברים ע\"י קבלן מבצע", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "גלגלונים — ת\"י 2206 מכון מורשה", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "ברזי כיבוי — ת\"י 1205 מכון מורשה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "כיבוי אש — בדיקות",
    name: "תסקיר מעלית סופי ממכון מורשה (ת\"י 2481)",
    description: "בטיפול, צפי שבועיים.",
    status: "IN_PROGRESS"
  },
  { section: "כיבוי אש — בדיקות", name: "מכון מורשה ת\"י 158 — גז", description: "התקבל.", status: "COMPLETED" },
  { section: "כיבוי אש — בדיקות", name: "דלתות אש — מכון מורשה ת\"י 1212", description: "התקבל.", status: "COMPLETED" },
  {
    section: "כיבוי אש — בדיקות",
    name: "אפיון רשת מים לקומה עליונה + גמל מים — מכון מורשה",
    description: "בדיקה 29/12.",
    status: "IN_PROGRESS"
  },
  { section: "כיבוי אש — בדיקות", name: "ת\"י 1596 — ספרינקלרים — מכון מורשה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "כיבוי אש — בדיקות",
    name: "ת\"י 1220 גילוי אש חלק 3",
    description: "אין מערכת גילוי — לא רלוונטי בפרויקט.",
    status: "COMPLETED"
  },
  {
    section: "כיבוי אש — בדיקות",
    name: "ת\"י 1220 גלאים עצמאיים חלק 5",
    description: "אין בפרויקט בתוכנית כיבוי כלל — לא רלוונטי.",
    status: "COMPLETED"
  },
  { section: "כיבוי אש — בדיקות", name: "ביצוע שילוט ותאורת חירום בדרכי מוצא בבניין", status: "OPEN" },

  // === Section 6: Water Corporation (Maniv) ===
  { section: "תאגיד מים — מני\"ב", name: "בדיקת מים חמים/קרים בדירות", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת נקזים ודלוחים בתוך המבנה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת ביוב מחוץ למבנה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת הגברת לחץ מים", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "צנרת מים משותפת בתוך המבנה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת מים מחוץ למבנה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת כיבוי אש וגלגלונים", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "מערכת סולארית", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "עבודות גמר — קבועות שרברבות / כלים סניטריים", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "אישור שטיפה וחיטוי", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "אישור מזח בגמל ובמשאבות", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "ריכוז אינסטלציה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "אישור מתכנן אינסטלציה (נספח ד')", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "טופס חיוב צריכה משותפת נספח ו' — חתום ע\"י הקבלן", status: "OPEN" },
  { section: "תאגיד מים — מני\"ב", name: "תכנית as-made לעבודות אינסטלציה", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "נספח סניטרי מאושר", description: "התקבל.", status: "COMPLETED" },
  { section: "תאגיד מים — מני\"ב", name: "אישור יועץ בטיחות שהכל נעשה בהתאם לדרישות הכיבוי", status: "OPEN" },
  { section: "תאגיד מים — מני\"ב", name: "טופס היעדר חובות", status: "OPEN" },
  { section: "תאגיד מים — מני\"ב", name: "אישור תשלום עבור מדי מים דירתיים — לאחר ביקורת", status: "OPEN" },

  // === Section 7: Department approvals ===
  { section: "אישורי מחלקות", name: "אישור תברואה", description: "נחתם.", status: "COMPLETED" },
  {
    section: "אישורי מחלקות",
    name: "אישור אגף מיפוי ומדידות (הסדרי קרקע)",
    description: "יש הפקעה, ממתינים לאישור תצ\"ר. סיגל מטפלת מול מפ\"י, יש אישור משלמים אגרה 06/01.",
    status: "IN_PROGRESS"
  },
  {
    section: "אישורי מחלקות",
    name: "אישור גינון והשקיה",
    description: "נחתם. איש קשר: אבנר סמוכי 03-9547643.",
    status: "COMPLETED"
  },
  {
    section: "אישורי מחלקות",
    name: "אישור מהנדס מחלקת תנועה למכפיל חניה + תסקיר מתקן",
    description: "אין מתקן חניה — מאושר. לשלוח לואדים נספח תנועה ולהזמין לביקורת: vadimk@rishonlezion.muni.il. תסקיר מתקן 03-9547632.",
    status: "COMPLETED"
  },
  { section: "אישורי מחלקות", name: "אישור אגף הכספים על היעדר חובות", description: "נחתם.", status: "COMPLETED" },
  { section: "אישורי מחלקות", name: "אישור מחלקת גבייה / אגרות", description: "נחתם.", status: "COMPLETED" },
  { section: "אישורי מחלקות", name: "אישור מבקר הרישוי", description: "חותם אחרון אחרי פיקוח.", status: "OPEN" },
  {
    section: "אישורי מחלקות",
    name: "אישור החברה המבצעת את פיתוח השכונה",
    description: "בשכונות חדשות באחריות חכ\"ר.",
    status: "OPEN"
  },
  { section: "אישורי מחלקות", name: "אישור איכות הסביבה — דוח קרינה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "אישורי מחלקות",
    name: "אישור איכות הסביבה — דוח אקוסטיקה + תרמי + אסבסט",
    description: "הכל התקבל. אקוסטיקה ירד. מחכים רק לאסבסט 04/01.",
    status: "IN_PROGRESS"
  },
  {
    section: "אישורי מחלקות",
    name: "אישור איכות הסביבה — פסולת (התקשרות + הטמנה + שקילות)",
    description: "התקבל.",
    status: "COMPLETED"
  },
  { section: "אישורי מחלקות", name: "אישור מחלקת פיקוח על הבניה", status: "OPEN" },

  // === Section 8: Additional requirements ===
  { section: "דרישות נוספות", name: "מפה טופוגרפית מודפסת — מפה", description: "התקבל.", status: "COMPLETED" },
  {
    section: "דרישות נוספות",
    name: "מפה טופוגרפית מודפסת — תצהיר מודד",
    description: "נשלח לנדיר 17/12.",
    status: "IN_PROGRESS"
  },
  {
    section: "דרישות נוספות",
    name: "אישור יועץ נגישות על ביצוע הנגישות",
    description: "מבקש תמונות מיזהר ובטיחות ישירות וישלח אישור 06/01.",
    status: "IN_PROGRESS"
  },
  { section: "דרישות נוספות", name: "תשריט טאבו חתום ע\"י עו\"ד", description: "בסיום פרויקט.", status: "OPEN" },
  {
    section: "דרישות נוספות",
    name: "התקנת מספר בית מואר",
    description: "הוזמן, ממתינים להגעה 16/11.",
    status: "IN_PROGRESS"
  },
  { section: "דרישות נוספות", name: "ערבות בנקאית עבור תעודת גמר", description: "בסיום פרויקט.", status: "OPEN" },
  { section: "דרישות נוספות", name: "הצבת דפיברילטור בבניין", description: "בסיום פרויקט.", status: "OPEN" }
];

function statusFlags(s: TaskStatus): { frozen: boolean; completedAt: Date | null; startedAt: Date | null } {
  const now = new Date();
  if (s === "COMPLETED") return { frozen: false, completedAt: now, startedAt: now };
  if (s === "IN_PROGRESS") return { frozen: false, completedAt: null, startedAt: now };
  if (s === "AWAITING_AUTHORITY") return { frozen: true, completedAt: null, startedAt: now };
  return { frozen: false, completedAt: null, startedAt: null };
}

async function main() {
  console.log(`\n=== Import Ushishkin 39 — ${DRY_RUN ? "DRY RUN" : "EXECUTING"} ===\n`);

  // Group counts for visibility
  const byStatus = ROWS.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const bySection = ROWS.reduce<Record<string, number>>((acc, r) => {
    acc[r.section] = (acc[r.section] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Tasks by section:");
  for (const [k, v] of Object.entries(bySection)) console.log(`  • ${k}: ${v}`);
  console.log("\nTasks by status:");
  for (const [k, v] of Object.entries(byStatus)) console.log(`  • ${k}: ${v}`);
  console.log(`\nTOTAL: ${ROWS.length} tasks\n`);

  if (DRY_RUN) {
    console.log("DRY RUN — no DB changes. Re-run without --dry-run to execute.");
    return;
  }

  const result = await prisma.$transaction(
    async (tx) => {
      // ---- Authority (find or create) ----
      const authority = await tx.authority.upsert({
        where: { name: AUTHORITY_NAME },
        update: {},
        create: { name: AUTHORITY_NAME, region: "מחוז מרכז" }
      });
      console.log(`Authority: ${authority.name} (${authority.id})`);

      // ---- BuildingType (find or create) ----
      const buildingType = await tx.buildingType.upsert({
        where: { name: BUILDING_TYPE_NAME },
        update: {},
        create: { name: BUILDING_TYPE_NAME, description: "בניין מגורים רב-קומות" }
      });
      console.log(`BuildingType: ${buildingType.name} (${buildingType.id})`);

      // ---- Client (always create new — no unique on companyName) ----
      const client = await tx.client.create({
        data: {
          companyName: CLIENT_NAME,
          contactName: CLIENT_NAME,
          phone: "—"
        }
      });
      await logAudit(tx, { entityType: AuditEntity.CLIENT, entityId: client.id, action: AuditAction.CREATE, newValue: { companyName: CLIENT_NAME } });
      console.log(`Client: ${client.companyName} (${client.id})`);

      // ---- MasterDeal ----
      const masterDeal = await tx.masterDeal.create({
        data: {
          clientId: client.id,
          name: MASTER_DEAL_NAME,
          status: "ACTIVE"
        }
      });
      await logAudit(tx, { entityType: AuditEntity.MASTER_DEAL, entityId: masterDeal.id, action: AuditAction.CREATE, newValue: { name: MASTER_DEAL_NAME } });
      console.log(`MasterDeal: ${masterDeal.name} (${masterDeal.id})`);

      // ---- Permit ----
      const permit = await tx.permit.create({
        data: {
          masterDealId: masterDeal.id,
          authorityId: authority.id,
          name: PERMIT_NAME,
          type: "טופס 4",
          status: "IN_PROGRESS",
          startDate: new Date(),
          expectedCloseDate: PERMIT_DEADLINE
        }
      });
      await logAudit(tx, { entityType: AuditEntity.PERMIT, entityId: permit.id, action: AuditAction.CREATE, newValue: { name: PERMIT_NAME } });
      console.log(`Permit: ${permit.name} (${permit.id})`);

      // ---- Building ----
      const building = await tx.building.create({
        data: {
          permitId: permit.id,
          label: "אוסישקין 39",
          type: BUILDING_TYPE_NAME,
          address: "אוסישקין 39, ראשון לציון"
        }
      });
      await logAudit(tx, { entityType: AuditEntity.BUILDING, entityId: building.id, action: AuditAction.CREATE, newValue: { label: building.label } });
      console.log(`Building: ${building.label} (${building.id})`);

      // ---- Tasks ----
      let created = 0;
      for (const row of ROWS) {
        const flags = statusFlags(row.status);
        const taskName = `[${row.section}] ${row.name}`;
        const task = await tx.task.create({
          data: {
            permitId: permit.id,
            name: taskName,
            description: row.description,
            status: row.status,
            frozen: flags.frozen,
            startedAt: flags.startedAt,
            completedAt: flags.completedAt
          }
        });
        await logAudit(tx, {
          entityType: AuditEntity.TASK,
          entityId: task.id,
          action: AuditAction.CREATE,
          newValue: { name: taskName, status: row.status, section: row.section }
        });
        created++;
      }
      console.log(`Tasks created: ${created}`);

      return { clientId: client.id, masterDealId: masterDeal.id, permitId: permit.id, taskCount: created };
    },
    { timeout: 60_000, maxWait: 60_000 }
  );

  console.log(`\n✓ Import complete.`);
  console.log(`  Permit URL path: /permits/${result.permitId}/tasks`);
  console.log(`  Client URL path: /clients/${result.clientId}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
