import { prisma } from "@/lib/prisma";
import {
  BuildingTypesPageClient,
  type BuildingTypeRow
} from "@/components/settings/building-types-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsBuildingTypesPage() {
  const types = await prisma.buildingType.findMany({
    include: { _count: { select: { taskTemplates: true } } },
    orderBy: { name: "asc" }
  });

  const rows: BuildingTypeRow[] = types.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    templateCount: t._count.taskTemplates
  }));

  return <BuildingTypesPageClient rows={rows} />;
}
