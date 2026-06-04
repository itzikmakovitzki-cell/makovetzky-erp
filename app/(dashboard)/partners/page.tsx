import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PartnersMarketplace } from "@/components/partners/partners-marketplace";

export const dynamic = "force-dynamic";

// Block 30 polish — back-office marketplace view. Same renderer the portal
// uses (components/partners/partners-marketplace.tsx). ADMIN sees all
// permits as request targets (PortalScope kind="admin"); EMPLOYEE sees
// permits for clients they have PortalAccess to (same rule as everything
// else under /portal).

export default async function DashboardPartnersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, role: session.user.role };

  return <PartnersMarketplace user={user} />;
}
