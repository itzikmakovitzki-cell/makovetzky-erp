import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

// Returns the authenticated user from the Auth.js session.
// Server Actions invoked from protected routes can rely on middleware to keep
// unauthenticated requests out, but we still validate here for defense in depth.
//
// The jwt callback in auth.ts deliberately leaves a deactivated user's token
// intact (to avoid a surprise mid-work logout) and defers enforcement to this
// boundary. So every Node-runtime call (server actions, page renders) re-checks
// isActive against the DB here — this is the one place that actually blocks a
// deactivated/deleted user, not just middleware (which is Edge-only and JWT-based).
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true }
  });
  if (!dbUser || !dbUser.isActive) {
    throw new Error("המשתמש מושבת");
  }
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role
  };
}

export async function requireRole(allowed: UserRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!allowed.includes(user.role)) {
    throw new Error("אין הרשאה לפעולה זו");
  }
  return user;
}
