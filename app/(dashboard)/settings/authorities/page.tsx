import { prisma } from "@/lib/prisma";
import {
  AuthoritiesPageClient,
  type AuthorityRow
} from "@/components/settings/authorities-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsAuthoritiesPage() {
  const authorities = await prisma.authority.findMany({
    include: {
      _count: {
        select: { permits: true, taskTemplates: true, wikiEntries: true }
      }
    },
    orderBy: { name: "asc" }
  });

  const rows: AuthorityRow[] = authorities.map((a) => ({
    id: a.id,
    name: a.name,
    region: a.region,
    contactInfo: a.contactInfo,
    permitCount: a._count.permits,
    templateCount: a._count.taskTemplates,
    wikiCount: a._count.wikiEntries
  }));

  return <AuthoritiesPageClient rows={rows} />;
}
