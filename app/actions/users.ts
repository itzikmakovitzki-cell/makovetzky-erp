"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
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
