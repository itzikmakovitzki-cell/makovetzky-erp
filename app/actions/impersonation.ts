"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth, unstable_update } from "@/auth";
import { AuditEntity, logAudit } from "@/lib/audit";

// Block 43 — admin impersonation. Lets an ADMIN take on the session of
// another active user (employee or contractor) so they can see exactly
// what that user sees, then return to themselves.
//
// Safety rules enforced server-side (the client UI shows the launcher
// only to admins, but the server is the actual gate):
//   * Only ADMIN can start an impersonation. Anyone else → throw.
//   * Cannot impersonate yourself (no-op confusion).
//   * Cannot start a new impersonation while already impersonating —
//     prevents an attacker who gained control of an impersonated
//     session from chaining their way somewhere else. The session must
//     be returned to the original admin first.
//   * Audit every start AND stop with both parties identified.
//
// The actual JWT mutation happens client-side via `useSession().update()`
// once this action returns — the JWT callback in auth.ts handles the
// rewrite. This action's job is the gate + the audit row.

export type StartImpersonationResult =
  | { ok: true; targetUserId: string; targetName: string; targetRole: string }
  | { ok: false; error: string };

export async function startImpersonating(
  targetUserId: string
): Promise<StartImpersonationResult> {
  try {
    const session = await auth();
    const me = session?.user;
    if (!me?.id) return { ok: false, error: "אינך מחובר" };
    if (me.role !== "ADMIN") {
      return { ok: false, error: "הרשאה זו פתוחה רק לאדמין" };
    }
    if (session?.impersonating) {
      return {
        ok: false,
        error: "כבר במצב התחזות. חזור לעצמך לפני שמתחזה לעוד מישהו."
      };
    }
    if (!targetUserId) {
      return { ok: false, error: "חסר מזהה משתמש יעד" };
    }
    if (targetUserId === me.id) {
      return { ok: false, error: "אי אפשר להתחזות לעצמך" };
    }

    const target = await prisma.user.findFirst({
      where: { id: targetUserId, isActive: true },
      select: { id: true, name: true, email: true, role: true }
    });
    if (!target) {
      return { ok: false, error: "המשתמש לא נמצא או לא פעיל" };
    }

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        entityType: AuditEntity.IMPERSONATION,
        entityId: target.id,
        action: AuditAction.CREATE,
        newValue: {
          phase: "start",
          targetUserId: target.id,
          targetName: target.name,
          targetRole: target.role,
          targetEmail: target.email,
          actingAdminId: me.id,
          actingAdminName: me.name ?? null
        },
        userId: me.id
      });
    });

    // Trigger the JWT callback's impersonation branch. The next render
    // sees the impersonated user in `session.user`; the original admin
    // is preserved on `session.impersonating`. The DB refresh inside
    // the JWT callback fills in name/email/role from the target row.
    await unstable_update({
      action: "impersonate",
      targetUserId: target.id
    } as unknown as Parameters<typeof unstable_update>[0]);

    revalidatePath("/", "layout");

    return {
      ok: true,
      targetUserId: target.id,
      targetName: target.name,
      targetRole: target.role
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בהפעלת ההתחזות"
    };
  }
}

export type StopImpersonationResult =
  | { ok: true; originalUserId: string }
  | { ok: false; error: string };

export async function stopImpersonating(): Promise<StopImpersonationResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "אינך מחובר" };
    if (!session.impersonating) {
      return { ok: false, error: "אינך במצב התחזות" };
    }

    const originalUserId = session.impersonating.originalUserId;
    const impersonatedUserId = session.user.id;

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        entityType: AuditEntity.IMPERSONATION,
        entityId: impersonatedUserId,
        action: AuditAction.UPDATE,
        newValue: {
          phase: "stop",
          impersonatedUserId,
          originalUserId,
          originalName: session.impersonating?.originalName ?? null
        },
        // The "actor" returning to themselves is logged as the original
        // admin so the row threads back to their identity in the audit log.
        userId: originalUserId
      });
    });

    await unstable_update({
      action: "stop-impersonating"
    } as unknown as Parameters<typeof unstable_update>[0]);

    revalidatePath("/", "layout");

    return { ok: true, originalUserId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה ביציאה מהתחזות"
    };
  }
}

// Lookup feeder for the launcher dialog. ADMIN-only — surfaces every
// other active user so the admin can pick a target. We never expose
// the calling admin themselves (can't impersonate yourself) or
// inactive users (they can't sign in anyway).
export type ImpersonationCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function listImpersonationCandidates(): Promise<{
  ok: boolean;
  users?: ImpersonationCandidate[];
  error?: string;
}> {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { ok: false, error: "הרשאה זו פתוחה רק לאדמין" };
    }
    const meId = session.user.id;
    const users = await prisma.user.findMany({
      where: { isActive: true, NOT: { id: meId } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });
    return { ok: true, users };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה בטעינת רשימת המשתמשים"
    };
  }
}
