import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  RecycleBinClient,
  type RecycleBinData,
  type TrashedRow
} from "@/components/settings/recycle-bin-client";

export const dynamic = "force-dynamic";

export default async function RecycleBinPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    redirect("/permits");
  }

  // Each of the 5 lists is `deletedAt: { not: null }`, ordered by deletion time
  // descending so the most recently trashed items surface first.
  const [clients, masterDeals, permits, tasks, documents] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, companyName: true, contactName: true, deletedAt: true },
      orderBy: { deletedAt: "desc" }
    }),
    prisma.masterDeal.findMany({
      where: { deletedAt: { not: null } },
      include: { client: { select: { companyName: true } } },
      orderBy: { deletedAt: "desc" }
    }),
    prisma.permit.findMany({
      where: { deletedAt: { not: null } },
      select: {
        id: true,
        name: true,
        permitNumber: true,
        deletedAt: true
      },
      orderBy: { deletedAt: "desc" }
    }),
    prisma.task.findMany({
      where: { deletedAt: { not: null } },
      include: { permit: { select: { id: true, name: true } } },
      orderBy: { deletedAt: "desc" }
    }),
    prisma.document.findMany({
      where: { deletedAt: { not: null } },
      include: { permit: { select: { id: true, name: true } } },
      orderBy: { deletedAt: "desc" }
    })
  ]);

  const rowFromClient = (c: typeof clients[number]): TrashedRow => ({
    id: c.id,
    label: c.companyName,
    secondary: c.contactName,
    deletedAt: c.deletedAt!.toISOString()
  });

  const rowFromMasterDeal = (d: typeof masterDeals[number]): TrashedRow => ({
    id: d.id,
    label: d.name,
    secondary: d.client.companyName,
    deletedAt: d.deletedAt!.toISOString()
  });

  const rowFromPermit = (p: typeof permits[number]): TrashedRow => ({
    id: p.id,
    label: p.name,
    secondary: p.permitNumber,
    deletedAt: p.deletedAt!.toISOString()
  });

  const rowFromTask = (t: typeof tasks[number]): TrashedRow => ({
    id: t.id,
    label: t.name,
    secondary: t.permit.name,
    deletedAt: t.deletedAt!.toISOString()
  });

  const rowFromDocument = (d: typeof documents[number]): TrashedRow => ({
    id: d.id,
    label: `${d.fileName} (v${d.version})`,
    secondary: d.permit.name,
    deletedAt: d.deletedAt!.toISOString()
  });

  const data: RecycleBinData = {
    client: clients.map(rowFromClient),
    masterDeal: masterDeals.map(rowFromMasterDeal),
    permit: permits.map(rowFromPermit),
    task: tasks.map(rowFromTask),
    document: documents.map(rowFromDocument)
  };

  return <RecycleBinClient data={data} />;
}
