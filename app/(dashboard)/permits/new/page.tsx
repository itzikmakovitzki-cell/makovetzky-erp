import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "@/components/projects/new-project-form";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  // Defense in depth — middleware already gates /permits to ADMIN+EMPLOYEE,
  // but project creation is admin-only. Bounce non-admins to the list.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/permits");
  }

  const [clients, authorities, buildingTypes, templateCounts] = await Promise.all([
    prisma.client.findMany({
      select: { id: true, companyName: true, contactName: true },
      orderBy: { companyName: "asc" }
    }),
    prisma.authority.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.buildingType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.taskTemplate.groupBy({
      by: ["authorityId", "buildingTypeId"],
      where: { isActive: true },
      _count: { _all: true }
    })
  ]);

  const templateCountByCombo: Record<string, number> = {};
  for (const row of templateCounts) {
    templateCountByCombo[`${row.authorityId}:${row.buildingTypeId}`] = row._count._all;
  }

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h1 className="text-base font-semibold">פרויקט חדש</h1>
        <p className="text-[11px] text-muted-foreground">
          יצירת לקוח (אם חדש) + עסקה + היתר. משימות יווצרו אוטומטית מתבניות
          לפי רשות + סוג בניין שתבחר.
        </p>
      </header>

      <NewProjectForm
        clients={clients}
        authorities={authorities}
        buildingTypes={buildingTypes}
        templateCountByCombo={templateCountByCombo}
      />
    </section>
  );
}
