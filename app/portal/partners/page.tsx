import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { PartnersMarketplace } from "@/components/partners/partners-marketplace";

export const dynamic = "force-dynamic";

// Block 30 — portal-side marketplace. Same content as
// /(dashboard)/partners — they share the PartnersMarketplace renderer.
// Difference is only the back-link chrome.

export default async function PortalPartnersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = { id: session.user.id, role: session.user.role };

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

      <PartnersMarketplace user={user} />
    </div>
  );
}
