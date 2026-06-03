import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Full auth instance. Imports Prisma + bcryptjs (Node-only) — never use this
// from middleware or any Edge-runtime context. Middleware uses authConfig
// directly via `NextAuth(authConfig)` in middleware.ts.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    // Override the jwt callback with a DB-backed refresh. The Edge-safe
    // version in auth.config.ts only copies id/role from the user object
    // at sign-in, so a JWT keeps showing the old name/email/role even
    // after an admin updates the User row. This callback pulls the
    // canonical values from the DB on every Node-runtime request (page
    // renders, server actions, route handlers) — small DB hit, but the
    // user table is tiny and the request is already DB-bound.
    //
    // Middleware still uses the Edge-safe callback (no DB) so role gates
    // there can lag for ~one navigation after a role change. That's fine
    // — role changes are rare and the next request through Node will
    // catch up.
    jwt: async ({ token, user }) => {
      // Sign-in path: seed the token from the credentials user object.
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: UserRole }).role;
        token.name = user.name;
        token.email = user.email;
      }

      // Subsequent calls (and explicit session.update() triggers): refresh
      // name/email/role from DB so display fields stay in sync without a
      // logout/login cycle.
      if (typeof token.id === "string") {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id },
          select: { name: true, email: true, role: true, isActive: true }
        });
        if (fresh && fresh.isActive) {
          token.name = fresh.name;
          token.email = fresh.email;
          token.role = fresh.role;
        }
        // If the user was deactivated or deleted we intentionally do NOT
        // clear the token here — middleware and route guards are the
        // place to enforce that. Leaving the stale token avoids surprise
        // logouts in the middle of work.
      }

      return token;
    }
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ]
});
