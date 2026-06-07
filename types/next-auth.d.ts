import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
    // Block 43: when an ADMIN impersonates another user, the session
    // surfaces this so the UI can render the banner + "back to myself"
    // button. session.user fields are the IMPERSONATED user (so all
    // role-gated code Just Works); the original admin is stashed here.
    impersonating?: {
      originalUserId: string;
      originalName: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    // Block 43 impersonation state. When set, the rest of the token
    // (id/role/name/email) represents the IMPERSONATED user and these
    // two fields preserve the original ADMIN so we can switch back.
    originalUserId?: string;
    originalName?: string;
  }
}
