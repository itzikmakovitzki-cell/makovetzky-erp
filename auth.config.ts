import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

// Edge-safe config used by middleware. NO imports from Prisma, bcryptjs, or
// other Node-only modules — only the JWT/session shape and pages config.
// The actual Credentials provider lives in auth.ts and is reserved for
// Server Components / API routes / Server Actions.
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        if (token.role) session.user.role = token.role as UserRole;
      }
      return session;
    }
  }
} satisfies NextAuthConfig;
