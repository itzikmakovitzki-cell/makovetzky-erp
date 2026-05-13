import type { UserRole } from "@prisma/client";
import { auth } from "@/auth";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

// Returns the authenticated user from the Auth.js session.
// Server Actions invoked from protected routes can rely on middleware to keep
// unauthenticated requests out, but we still validate here for defense in depth.
export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
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
