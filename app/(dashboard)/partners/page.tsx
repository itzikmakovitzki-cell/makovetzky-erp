import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PartnersMarketplace } from "@/components/partners/partners-marketplace";

export const dynamic = "force-dynamic";

export default async function DashboardPartnersPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, role: session.user.role };
  const sp = await searchParams;
  const search = {
    category: typeof sp.category === "string" ? sp.category : undefined,
    q: typeof sp.q === "string" ? sp.q : undefined
  };

  return (
    <PartnersMarketplace user={user} basePath="/partners" search={search} />
  );
}
