import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// Full auth instance. Imports Prisma + bcryptjs (Node-only) — never use this
// from middleware or any Edge-runtime context. Middleware uses authConfig
// directly via `NextAuth(authConfig)` in middleware.ts.
export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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
    jwt: async ({ token, user, trigger, session }) => {
      // Sign-in path: seed the token from the credentials user object.
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: UserRole }).role;
        token.name = user.name;
        token.email = user.email;
      }

      // Block 43 — impersonation hooks. `update()` from the client triggers
      // this callback with `trigger === "update"` and the new session
      // object as `session`. We trust the server action that gates
      // role + audit (app/actions/impersonation.ts) and just mutate
      // the token here. The DB refresh below picks up the impersonated
      // user's name/email/role automatically.
      if (trigger === "update" && session) {
        const action = (session as { action?: string }).action;
        if (action === "impersonate") {
          const targetId = (session as { targetUserId?: string }).targetUserId;
          if (typeof targetId === "string" && targetId && !token.originalUserId) {
            // Stash the ORIGINAL admin so we can switch back. We do
            // this only when not already impersonating — never let an
            // impersonated session start a fresh chain.
            token.originalUserId = token.id;
            token.originalName = token.name ?? "";
            token.id = targetId;
            // Wipe the cached display fields so the DB refresh below
            // populates them from the target's row.
            token.name = undefined;
            token.email = undefined;
            token.role = undefined;
          }
        } else if (action === "stop-impersonating") {
          if (token.originalUserId) {
            token.id = token.originalUserId;
            token.originalUserId = undefined;
            token.originalName = undefined;
            token.name = undefined;
            token.email = undefined;
            token.role = undefined;
          }
        }
      }

      // Subsequent calls (and explicit session.update() triggers): refresh
      // name/email/role from DB so display fields stay in sync without a
      // logout/login cycle. This is also what makes impersonation
      // visible — once token.id changed, this block pulls the
      // impersonated user's row.
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
    },
    // Surface the impersonation marker on the session so client UI
    // can render the banner + "back to myself" button. The Edge-safe
    // session callback in auth.config doesn't see these JWT fields
    // (middleware doesn't need them), so we override it here.
    session: async ({ session, token }) => {
      if (session.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        if (token.role) session.user.role = token.role as UserRole;
      }
      if (typeof token.originalUserId === "string") {
        session.impersonating = {
          originalUserId: token.originalUserId,
          originalName:
            typeof token.originalName === "string" ? token.originalName : ""
        };
      }
      return session;
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
