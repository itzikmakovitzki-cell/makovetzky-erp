import { PrismaClient, UserRole, TaskStatus, TaskPriority, MilestoneStatus, SupplierAssignmentStatus, PendingDocumentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD_HASH = bcrypt.hashSync("admin123", 10);

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function clean() {
  // Order matters — children before parents.
  await prisma.pendingDocument.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.note.deleteMany();
  await prisma.document.deleteMany();
  await prisma.supplierTaskAssignment.deleteMany();
  await prisma.billingMilestone.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskTemplateDependency.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.authorityWikiEntry.deleteMany();
  await prisma.building.deleteMany();
  await prisma.permit.deleteMany();
  await prisma.masterDeal.deleteMany();
  await prisma.portalAccess.deleteMany();
  await prisma.client.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.buildingType.deleteMany();
  await prisma.authority.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log("→ Cleaning existing data…");
  await clean();

  // ----- Users -----
  console.log("→ Seeding users…");
  const admin = await prisma.user.create({
    // Email kept as the legacy `ofir@…` for stability — PortalAccess + AuditLog
    // reference users by id, but the email is the user-visible login string. The
    // display name is the customer's actual name (Itzik Makovetzky).
    data: { email: "ofir@makovetzky.local", name: "איציק מקובצקי", role: UserRole.ADMIN, passwordHash: PASSWORD_HASH }
  });
  const employeeYossi = await prisma.user.create({
    data: { email: "yossi@makovetzky.local", name: "יוסי לוי", role: UserRole.EMPLOYEE, passwordHash: PASSWORD_HASH }
  });
  const employeeDana = await prisma.user.create({
    data: { email: "dana@makovetzky.local", name: "דנה כהן", role: UserRole.EMPLOYEE, passwordHash: PASSWORD_HASH }
  });
  const contractor = await prisma.user.create({
    data: { email: "contact@cohenbrothers.local", name: "ישראל כהן", role: UserRole.CONTRACTOR, passwordHash: PASSWORD_HASH }
  });

  // ----- Authorities + Wiki -----
  console.log("→ Seeding authorities and wiki…");
  const rehovot = await prisma.authority.create({
    data: {
      name: "עיריית רחובות",
      region: "מחוז המרכז",
      contactInfo: "מחלקת רישוי בנייה — טל' 08-9392222",
      wikiEntries: {
        create: [
          {
            title: "טיפים להגשת תכניות אדריכליות",
            category: "תכנון",
            contentMd: [
              "## דגשים חשובים",
              "",
              "- חתימת אדריכל מורשה **חובה** על כל גיליון.",
              "- קנה מידה: 1:100 בתכניות העקרוניות.",
              "- מנהל הרישוי בעיריה דורש שני עותקים קשיחים בנוסף לדיגיטלי.",
              "",
              "**זמן תגובה ממוצע:** 14–21 ימי עסקים."
            ].join("\n")
          },
          {
            title: "אגרות בנייה — כללי תשלום",
            category: "כספים",
            contentMd: [
              "- התשלום מתבצע *רק* בהעברה בנקאית למוסד עירוני.",
              "- שמור את אסמכתת התשלום — נדרש כתנאי לפתיחת תיק.",
              "- ניתן לפצל לתשלומים, אבל זה מאריך כל שלב ב-7 ימים בממוצע."
            ].join("\n")
          }
        ]
      }
    }
  });

  const telAviv = await prisma.authority.create({
    data: {
      name: "עיריית תל אביב",
      region: "מחוז תל אביב",
      contactInfo: "אגף רישוי ובנייה — טל' 03-7240000",
      wikiEntries: {
        create: [
          {
            title: "מסלול מקוון לקבלת היתר",
            category: "תכנון",
            contentMd: "כל ההגשות חייבות לעבור דרך המערכת המקוונת. **אין** לקבל מסמכים פיזית."
          }
        ]
      }
    }
  });

  // ----- Building Types -----
  console.log("→ Seeding building types…");
  const villaType = await prisma.buildingType.create({
    data: { name: "וילה פרטית", description: "בנייה למשפחה אחת, עד 2 קומות" }
  });
  const commercialType = await prisma.buildingType.create({
    data: { name: "מסחרי", description: "מבני משרדים, חנויות ומסחר" }
  });
  const towerType = await prisma.buildingType.create({
    data: { name: "מגדל מגורים", description: "בניין מגורים מעל 6 קומות" }
  });

  // ----- Suppliers -----
  console.log("→ Seeding suppliers…");
  const labSupplier = await prisma.supplier.create({
    data: {
      name: "מעבדות בדיקה ישראל",
      type: "מעבדה",
      contactName: "אבי שטרן",
      phone: "03-5555111",
      email: "lab@iltestlab.co.il",
      defaultCommissionType: "FIXED",
      defaultCommissionValue: 850
    }
  });
  const surveyorSupplier = await prisma.supplier.create({
    data: {
      name: "מודד אבי בן-דוד",
      type: "מודד",
      contactName: "אבי בן-דוד",
      phone: "050-1234567",
      email: "avi@survey.co.il",
      defaultCommissionType: "FIXED",
      defaultCommissionValue: 1200
    }
  });
  const electricianSupplier = await prisma.supplier.create({
    data: {
      name: 'חשמל בדיקות בע"מ',
      type: "יועץ חשמל",
      contactName: "רונן אברהמי",
      phone: "052-9876543",
      email: "ronen@electrocheck.co.il",
      defaultCommissionType: "FIXED",
      defaultCommissionValue: 950
    }
  });

  // ----- Task Templates (Rehovot + Villa) -----
  console.log("→ Seeding task templates + dependencies…");
  const tmplPlans = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "הגשת תכניות אדריכליות", defaultDurationDays: 14, orderIndex: 1 }
  });
  const tmplFees = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "תשלום אגרות בנייה", defaultDurationDays: 7, orderIndex: 2 }
  });
  const tmplConcrete = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "בדיקת בטון", defaultDurationDays: 10, orderIndex: 3 }
  });
  const tmplSurveyor = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "אישור מודד", defaultDurationDays: 7, orderIndex: 4 }
  });
  const tmplElectric = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "בדיקת חשמל", defaultDurationDays: 5, orderIndex: 5 }
  });
  const tmplForm4 = await prisma.taskTemplate.create({
    data: { authorityId: rehovot.id, buildingTypeId: villaType.id, name: "קבלת טופס 4", defaultDurationDays: 21, orderIndex: 6 }
  });

  // Strict AND dependencies
  await prisma.taskTemplateDependency.createMany({
    data: [
      { templateId: tmplFees.id, dependsOnTemplateId: tmplPlans.id },
      { templateId: tmplConcrete.id, dependsOnTemplateId: tmplFees.id },
      { templateId: tmplSurveyor.id, dependsOnTemplateId: tmplConcrete.id },
      { templateId: tmplElectric.id, dependsOnTemplateId: tmplFees.id },
      { templateId: tmplForm4.id, dependsOnTemplateId: tmplSurveyor.id },
      { templateId: tmplForm4.id, dependsOnTemplateId: tmplElectric.id }
    ]
  });

  // ----- Clients -----
  console.log("→ Seeding clients…");
  const cohen = await prisma.client.create({
    data: {
      companyName: "אחים כהן בנייה ופיתוח בע\"מ",
      hp: "514203187",
      contactName: "ישראל כהן",
      phone: "050-7777111",
      email: "office@cohenbrothers.local",
      address: "רחוב הרצל 45, רחובות"
    }
  });
  const levi = await prisma.client.create({
    data: {
      companyName: 'ש. לוי החזקות בע"מ',
      hp: "511894332",
      contactName: "שמואל לוי",
      phone: "054-2233445",
      email: "info@levi-realestate.local",
      address: "דרך מנחם בגין 121, תל אביב"
    }
  });

  // Portal access for contractor user
  await prisma.portalAccess.create({ data: { clientId: cohen.id, userId: contractor.id } });

  // ----- Master Deals -----
  console.log("→ Seeding master deals…");
  const cohenDeal = await prisma.masterDeal.create({
    data: {
      clientId: cohen.id,
      name: "פרויקט 7 וילות — רחובות",
      contractDate: daysFromNow(-90),
      totalValue: 12500000,
      notes: "פרויקט דגל — 7 וילות יוקרה במתחם חדש."
    }
  });
  const leviDeal = await prisma.masterDeal.create({
    data: {
      clientId: levi.id,
      name: "מבנה מעורב — תל אביב",
      contractDate: daysFromNow(-45),
      totalValue: 28000000
    }
  });

  // ----- Permits -----
  console.log("→ Seeding permits…");
  const cohenPermit = await prisma.permit.create({
    data: {
      masterDealId: cohenDeal.id,
      authorityId: rehovot.id,
      permitNumber: "REH-2026-0142",
      name: "טופס 4 — 7 וילות רחובות",
      type: "טופס 4",
      progressPercent: 35,
      startDate: daysFromNow(-60),
      expectedCloseDate: daysFromNow(120)
    }
  });
  const leviPermit = await prisma.permit.create({
    data: {
      masterDealId: leviDeal.id,
      authorityId: telAviv.id,
      permitNumber: "TLV-2026-0331",
      name: "טופס 4 — מגדל תל אביב",
      type: "טופס 4",
      progressPercent: 10,
      startDate: daysFromNow(-30),
      expectedCloseDate: daysFromNow(240)
    }
  });

  // ----- Buildings -----
  console.log("→ Seeding buildings…");
  for (let i = 1; i <= 7; i++) {
    await prisma.building.create({
      data: {
        permitId: cohenPermit.id,
        label: `וילה ${i}`,
        type: "וילה פרטית",
        address: `רחוב הזית ${i}, רחובות`
      }
    });
  }
  await prisma.building.create({
    data: { permitId: leviPermit.id, label: "מגדל A", type: "מגדל מגורים", address: "רחוב הירקון 200, תל אביב" }
  });

  // ----- Tasks (instantiated from templates for Cohen permit) -----
  console.log("→ Seeding tasks + dependencies…");
  const taskPlans = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplPlans.id, assigneeId: employeeYossi.id,
      name: tmplPlans.name, status: TaskStatus.COMPLETED, priority: TaskPriority.NORMAL,
      startedAt: daysFromNow(-58), completedAt: daysFromNow(-44),
      dueDate: daysFromNow(-44)
    }
  });
  const taskFees = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplFees.id, assigneeId: employeeYossi.id,
      name: tmplFees.name, status: TaskStatus.COMPLETED, priority: TaskPriority.NORMAL,
      startedAt: daysFromNow(-43), completedAt: daysFromNow(-36),
      dueDate: daysFromNow(-36)
    }
  });
  const taskConcrete = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplConcrete.id, assigneeId: employeeDana.id,
      name: tmplConcrete.name, status: TaskStatus.IN_PROGRESS, priority: TaskPriority.URGENT,
      isSpotlight: true,
      startedAt: daysFromNow(-30),
      dueDate: daysFromNow(-3) // overdue — should show in red on UI
    }
  });
  const taskSurveyor = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplSurveyor.id, assigneeId: employeeDana.id,
      name: tmplSurveyor.name, status: TaskStatus.BLOCKED, priority: TaskPriority.NORMAL,
      dueDate: daysFromNow(14)
    }
  });
  const taskElectric = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplElectric.id, assigneeId: employeeYossi.id,
      name: tmplElectric.name, status: TaskStatus.AWAITING_AUTHORITY, priority: TaskPriority.NORMAL,
      frozen: true, // paired with AWAITING_AUTHORITY — suppresses overdue alerts
      dueDate: daysFromNow(7)
    }
  });
  const taskForm4 = await prisma.task.create({
    data: {
      permitId: cohenPermit.id, templateId: tmplForm4.id, assigneeId: employeeYossi.id,
      name: tmplForm4.name, status: TaskStatus.BLOCKED, priority: TaskPriority.NORMAL,
      dueDate: daysFromNow(45)
    }
  });

  // Task dependencies (strict AND)
  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskFees.id, dependsOnTaskId: taskPlans.id },
      { taskId: taskConcrete.id, dependsOnTaskId: taskFees.id },
      { taskId: taskSurveyor.id, dependsOnTaskId: taskConcrete.id },
      { taskId: taskElectric.id, dependsOnTaskId: taskFees.id },
      { taskId: taskForm4.id, dependsOnTaskId: taskSurveyor.id },
      { taskId: taskForm4.id, dependsOnTaskId: taskElectric.id }
    ]
  });

  // ----- Supplier Task Assignments -----
  console.log("→ Seeding supplier task assignments…");
  await prisma.supplierTaskAssignment.create({
    data: { supplierId: labSupplier.id, taskId: taskConcrete.id, amount: 850, status: SupplierAssignmentStatus.IN_PROGRESS, dueDate: daysFromNow(-3) }
  });
  await prisma.supplierTaskAssignment.create({
    data: { supplierId: surveyorSupplier.id, taskId: taskSurveyor.id, amount: 1200, status: SupplierAssignmentStatus.OPEN, dueDate: daysFromNow(14) }
  });
  await prisma.supplierTaskAssignment.create({
    data: { supplierId: electricianSupplier.id, taskId: taskElectric.id, amount: 950, status: SupplierAssignmentStatus.COMPLETED, completedAt: daysFromNow(-1) }
  });

  // ----- Billing Milestones (1:1 with Tasks) -----
  console.log("→ Seeding billing milestones…");
  await prisma.billingMilestone.create({
    data: {
      permitId: cohenPermit.id, triggerTaskId: taskForm4.id,
      name: "תשלום סופי — קבלת טופס 4",
      amount: 50000, status: MilestoneStatus.PENDING,
      dueDate: daysFromNow(60),
      notes: "אבן הדרך המרכזית של הפרויקט."
    }
  });
  await prisma.billingMilestone.create({
    data: {
      permitId: cohenPermit.id, triggerTaskId: taskFees.id,
      name: "תשלום בגין הגשת תיק רישוי",
      amount: 15000, status: MilestoneStatus.PAID,
      triggeredAt: daysFromNow(-36),
      paidAt: daysFromNow(-30)
    }
  });

  // ----- Notes -----
  console.log("→ Seeding notes…");
  await prisma.note.create({
    data: {
      permitId: cohenPermit.id, authorId: admin.id, isPinned: true,
      content: "**חשוב:** הלקוח דורש עדכון שבועי בכל יום ראשון בבוקר. אל תפספס."
    }
  });
  await prisma.note.create({
    data: {
      permitId: cohenPermit.id, authorId: employeeDana.id,
      content: "המודד הציע לזמן את הבדיקה לפני סוף החודש כדי לחסוך עיכוב."
    }
  });

  // ----- Pending Documents (WhatsApp inbox) -----
  console.log("→ Seeding pending documents…");
  await prisma.pendingDocument.create({
    data: {
      senderInfo: "קבוצת WhatsApp: 7 וילות רחובות — שלח: דנה כהן",
      fileUrl: "https://example.local/storage/pending/concrete-test-villa-3.pdf",
      fileName: "concrete-test-villa-3.pdf",
      mimeType: "application/pdf",
      rawMessage: "תוצאות בדיקת בטון לוילה 3, התוצאות עברו במלואן.",
      status: PendingDocumentStatus.PENDING
    }
  });
  await prisma.pendingDocument.create({
    data: {
      senderInfo: "WhatsApp ישיר — אבי שטרן (מעבדה)",
      fileUrl: "https://example.local/storage/pending/lab-invoice-202604.pdf",
      fileName: "lab-invoice-202604.pdf",
      mimeType: "application/pdf",
      status: PendingDocumentStatus.PENDING
    }
  });

  console.log("✓ Seed complete.");
  console.log(`  Admin login: ofir@makovetzky.local / admin123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
