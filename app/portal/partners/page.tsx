import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { PartnersMarketplace } from "@/components/partners/partners-marketplace";

export const dynamic = "force-dynamic";

export default async function PortalPartnersPage({
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
    <div className="space-y-4">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה לפורטל
        </Link>
      </div>

      <PartnersMarketplace
        user={user}
        basePath="/portal/partners"
        search={search}
      />
    </div>
  );
}
