import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ClientsPageClient,
  type ClientRow
} from "@/components/clients/clients-page-client";

export const dynamic = "force-dynamic";

export default async function ClientsListPage() {
  // Admins manage the client book. Employees can browse permits but not edit clients.
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/permits");
  }

  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { companyName: "asc" },
    include: {
      masterDeals: {
        where: { deletedAt: null },
        select: {
          id: true,
          permits: {
            where: { deletedAt: null },
            select: { id: true, status: true }
          }
        }
      }
    }
  });

  const rows: ClientRow[] = clients.map((c) => {
    const permits = c.masterDeals.flatMap((d) => d.permits);
    const activePermitCount = permits.filter(
      (p) => p.status === "IN_PROGRESS" || p.status === "AWAITING_AUTHORITY" || p.status === "DRAFT"
    ).length;
    return {
      id: c.id,
      companyName: c.companyName,
      hp: c.hp,
      contactName: c.contactName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      notes: c.notes,
      dealCount: c.masterDeals.length,
      permitCount: permits.length,
      activePermitCount
    };
  });

  return <ClientsPageClient rows={rows} />;
}
