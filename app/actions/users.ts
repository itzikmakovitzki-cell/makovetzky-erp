"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type FormState = { error: string | null; ok: boolean };

const VALID_ROLES = new Set<UserRole>(["ADMIN", "EMPLOYEE", "CONTRACTOR"]);

export async function submitUser(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);
    const kind = String(formData.get("kind") || "");
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const phone = String(formData.get("phone") || "").trim() || null;
    const role = String(formData.get("role") || "") as UserRole;
    const password = String(formData.get("password") || "");

    if (!name) return { error: "שם חובה", ok: false };
    if (!email) return { error: "אימייל חובה", ok: false };
    if (!VALID_ROLES.has(role)) return { error: "תפקיד לא חוקי", ok: false };

    if (kind === "create") {
      if (!password || password.length < 6) {
        return { error: "סיסמה (לפחות 6 תווים) חובה", ok: false };
      }
      const passwordHash = await bcrypt.hash(password, 10);

      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: { name, email, phone, role, passwordHash, isActive: true }
          });
          await logAudit(tx, {
            entityType: AuditEntity.USER,
            entityId: user.id,
            action: AuditAction.CREATE,
            newValue: { name, email, phone, role },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "אימייל זה כבר רשום במערכת", ok: false };
        }
        throw e;
      }

      revalidatePath("/settings/users");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const userId = String(formData.get("userId") || "");
      if (!userId) return { error: "חסר מזהה משתמש", ok: false };

      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, role: true }
      });
      if (!existing) return { error: "משתמש לא נמצא", ok: false };

      // Self-safety: can't demote yourself from ADMIN — would lock you out.
      if (existing.id === me.id && existing.role === "ADMIN" && role !== "ADMIN") {
        return { error: "אינך יכול לשנות את התפקיד שלך מאדמין", ok: false };
      }

      const data: Prisma.UserUpdateInput = { name, email, phone, role };
      let passwordChanged = false;
      if (password) {
        if (password.length < 6) {
          return { error: "סיסמה חייבת להיות לפחות 6 תווים", ok: false };
        }
        data.passwordHash = await bcrypt.hash(password, 10);
        passwordChanged = true;
      }

      try {
        await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: userId }, data });
          await logAudit(tx, {
            entityType: AuditEntity.USER,
            entityId: userId,
            action: AuditAction.UPDATE,
            oldValue: {
              name: existing.name,
              email: existing.email,
              phone: existing.phone,
              role: existing.role
            },
            newValue: { name, email, phone, role, passwordChanged },
            userId: me.id
          });
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { error: "אימייל זה כבר רשום למשתמש אחר", ok: false };
        }
        throw e;
      }

      revalidatePath("/settings/users");
      return { error: null, ok: true };
    }

    return { error: "פעולה לא חוקית", ok: false };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה לא צפויה",
      ok: false
    };
  }
}

// =============================================================
// Password management (separate from submitUser/edit-user).
// =============================================================
//
// Two distinct flows, deliberately kept apart from the CRUD action above:
//
//   1. changeOwnPassword — any logged-in user changes their own password.
//      Requires the current password (bcrypt.compare). No role gate.
//   2. resetUserPassword — ADMIN-only override of another user's password.
//      No current-password check (admin auth is the gate). Self-target
//      blocked — admins use changeOwnPassword for their own (forces them
//      to know the current password, mild safety net).
//
// Both paths use bcrypt.hash(10), audit-log the change (no plaintext ever
// written), and enforce min length 8 (mirrors the spec NIST baseline —
// length matters more than complexity).

const PASSWORD_MIN_LENGTH = 8;

type PasswordChangeResult = { ok: true } | { ok: false; error: string };

function validateNewPassword(value: string): string | null {
  if (!value) return "סיסמה חדשה חובה";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `הסיסמה חייבת להיות לפחות ${PASSWORD_MIN_LENGTH} תווים`;
  }
  return null;
}

export async function changeOwnPassword(args: {
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeResult> {
  try {
    const me = await getCurrentUser();
    const validationErr = validateNewPassword(args.newPassword);
    if (validationErr) return { ok: false, error: validationErr };
    if (args.currentPassword === args.newPassword) {
      return { ok: false, error: "הסיסמה החדשה זהה לקיימת" };
    }

    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: { id: true, name: true, passwordHash: true }
    });
    if (!user) return { ok: false, error: "המשתמש לא נמצא" };

    const currentMatches = await bcrypt.compare(
      args.currentPassword,
      user.passwordHash
    );
    if (!currentMatches) {
      return { ok: false, error: "הסיסמה הנוכחית שגויה" };
    }

    const newHash = await bcrypt.hash(args.newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: me.id },
        data: { passwordHash: newHash }
      });
      await logAudit(tx, {
        entityType: AuditEntity.USER,
        entityId: me.id,
        action: AuditAction.UPDATE,
        // No before/after on the hash itself — we don't want even hashes in
        // the audit log if it ever leaks. Just record the event happened.
        newValue: { event: "password_changed_self", name: user.name },
        userId: me.id
      });
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שינוי הסיסמה נכשל"
    };
  }
}

export async function resetUserPassword(args: {
  userId: string;
  newPassword: string;
}): Promise<PasswordChangeResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const validationErr = validateNewPassword(args.newPassword);
    if (validationErr) return { ok: false, error: validationErr };

    // Self-reset must use changeOwnPassword so the admin re-verifies their
    // current password (small safeguard against someone walking up to an
    // unlocked screen).
    if (args.userId === me.id) {
      return {
        ok: false,
        error: "השתמש בעמוד 'שינוי סיסמה' כדי לשנות את הסיסמה שלך"
      };
    }

    const target = await prisma.user.findUnique({
      where: { id: args.userId },
      select: { id: true, name: true, email: true }
    });
    if (!target) return { ok: false, error: "המשתמש לא נמצא" };

    const newHash = await bcrypt.hash(args.newPassword, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: args.userId },
        data: { passwordHash: newHash }
      });
      await logAudit(tx, {
        entityType: AuditEntity.USER,
        entityId: args.userId,
        action: AuditAction.UPDATE,
        newValue: {
          event: "password_reset_by_admin",
          targetName: target.name,
          targetEmail: target.email
        },
        userId: me.id
      });
    });
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "איפוס הסיסמה נכשל"
    };
  }
}

export async function toggleUserActive(userId: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isActive: true }
  });
  if (!user) throw new Error("משתמש לא נמצא");
  if (user.id === me.id) throw new Error("אינך יכול להשבית את עצמך");

  const newActive = !user.isActive;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive: newActive } });
    await logAudit(tx, {
      entityType: AuditEntity.USER,
      entityId: userId,
      action: AuditAction.UPDATE,
      oldValue: { isActive: user.isActive },
      newValue: { isActive: newActive, name: user.name },
      userId: me.id
    });
  });

  revalidatePath("/settings/users");
}
