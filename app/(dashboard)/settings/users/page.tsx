import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UsersPageClient, type UserRow } from "@/components/settings/users-page-client";

export const dynamic = "force-dynamic";

export default async function SettingsUsersPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? "";

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }]
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString()
  }));

  return <UsersPageClient users={rows} currentUserId={currentUserId} />;
}
