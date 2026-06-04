import { prisma } from "@/lib/prisma";
import {
  PartnerCategoriesPageClient,
  type PartnerCategoryRow
} from "@/components/settings/partner-categories-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsPartnerCategoriesPage() {
  // Categories ordered by displayOrder then name — same sort the
  // marketplace grid and supplier-form dropdown use, so the admin always
  // sees the order their customers will see.
  const categories = await prisma.partnerCategory.findMany({
    include: { _count: { select: { suppliers: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
  });

  const rows: PartnerCategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    displayOrder: c.displayOrder,
    supplierCount: c._count.suppliers
  }));

  return <PartnerCategoriesPageClient rows={rows} />;
}
