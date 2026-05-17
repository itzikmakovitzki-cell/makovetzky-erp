"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

type ActionResult = { ok: boolean; error: string | null };

// Grants a CONTRACTOR (or CLIENT-role) user portal access to a specific
// client. From that moment on the user sees the client's permits in /portal,
// filtered down to tasks where they are the assignee.
export async function grantPortalAccess(
  clientId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    if (!clientId || !userId) {
      return { ok: false, error: "חסר לקוח או משתמש" };
    }

    const [client, user] = await Promise.all([
      prisma.client.findFirst({
        where: { id: clientId, deletedAt: null },
        select: { id: true, companyName: true }
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, isActive: true }
      })
    ]);
    if (!client) return { ok: false, error: "הלקוח לא נמצא" };
    if (!user) return { ok: false, error: "המשתמש לא נמצא" };
    if (!user.isActive) return { ok: false, error: "המשתמש מושבת" };
    // ADMIN/EMPLOYEE users already see everything; grant doesn't make sense
    // for them and could mislead the operator about access semantics.
    if (user.role !== "CONTRACTOR") {
      return { ok: false, error: "ניתן לקשר רק משתמשי קבלן" };
    }

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.portalAccess.create({
          data: { clientId, userId }
        });
        await logAudit(tx, {
          entityType: AuditEntity.PORTAL_ACCESS,
          entityId: created.id,
          action: AuditAction.CREATE,
          newValue: {
            clientId,
            clientName: client.companyName,
            userId,
            userName: user.name,
            userEmail: user.email
          },
          userId: me.id
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        return { ok: false, error: "למשתמש כבר יש גישה ללקוח זה" };
      }
      throw e;
    }

    revalidatePath(`/clients/${clientId}`);
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

export async function revokePortalAccess(
  clientId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const access = await prisma.portalAccess.findUnique({
      where: { clientId_userId: { clientId, userId } },
      include: {
        user: { select: { name: true, email: true } },
        client: { select: { companyName: true } }
      }
    });
    if (!access) return { ok: false, error: "הגישה לא נמצאה" };

    await prisma.$transaction(async (tx) => {
      await tx.portalAccess.delete({
        where: { clientId_userId: { clientId, userId } }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PORTAL_ACCESS,
        entityId: access.id,
        action: AuditAction.DELETE,
        oldValue: {
          clientId,
          clientName: access.client.companyName,
          userId,
          userName: access.user.name,
          userEmail: access.user.email
        },
        userId: me.id
      });
    });

    revalidatePath(`/clients/${clientId}`);
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}
