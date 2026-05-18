import { prisma } from "@/lib/prisma";
import {
  TemplatesPageClient,
  type TemplateRow
} from "@/components/settings/templates-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsTemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const authorityId =
    typeof params.authority === "string" && params.authority
      ? params.authority
      : null;
  const buildingTypeId =
    typeof params.buildingType === "string" && params.buildingType
      ? params.buildingType
      : null;

  const [authorities, buildingTypes, assignableUsers] = await Promise.all([
    prisma.authority.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.buildingType.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.user.findMany({
      // Block 20: contractors can be the default assignee on a template too —
      // useful when a template task is always owned by an external partner.
      where: { isActive: true, role: { in: ["ADMIN", "EMPLOYEE", "CONTRACTOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  let templates: TemplateRow[] = [];
  if (authorityId && buildingTypeId) {
    const raw = await prisma.taskTemplate.findMany({
      where: { authorityId, buildingTypeId },
      include: {
        dependsOn: {
          include: {
            dependsOnTemplate: { select: { id: true, name: true } }
          }
        },
        defaultAssignee: { select: { id: true, name: true } },
        _count: { select: { tasks: { where: { deletedAt: null } } } }
      },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }]
    });
    templates = raw.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      defaultDurationDays: t.defaultDurationDays,
      orderIndex: t.orderIndex,
      isActive: t.isActive,
      taskCount: t._count.tasks,
      deps: t.dependsOn.map((d) => ({
        id: d.dependsOnTemplate.id,
        name: d.dependsOnTemplate.name
      })),
      category: t.category,
      responsibility: t.responsibility,
      tags: t.tags,
      defaultAssignee: t.defaultAssignee
        ? { id: t.defaultAssignee.id, name: t.defaultAssignee.name }
        : null
    }));
  }

  return (
    <TemplatesPageClient
      authorities={authorities}
      buildingTypes={buildingTypes}
      assignableUsers={assignableUsers}
      selectedAuthorityId={authorityId}
      selectedBuildingTypeId={buildingTypeId}
      templates={templates}
    />
  );
}
