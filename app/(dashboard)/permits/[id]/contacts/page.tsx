import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ContactsGrid } from "@/components/contacts/contacts-grid";

export const dynamic = "force-dynamic";

// Block 33 — back-office tab for the Project Contacts Directory.
// ADMIN + EMPLOYEE land here; the same ContactsGrid component drives the
// portal counterpart so the data + visuals stay in lockstep.

export default async function PermitContactsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  const canManage = role === "ADMIN" || role === "EMPLOYEE";

  // Sanity-check the permit exists + isn't soft-deleted — layout already
  // does this but a direct hit on the tab without the layout (unlikely
  // but possible during refactors) shouldn't 500.
  const permit = await prisma.permit.findFirst({
    where: { id, deletedAt: null },
    select: { id: true }
  });
  if (!permit) notFound();

  return <ContactsGrid permitId={id} canManage={canManage} variant="card" />;
}
