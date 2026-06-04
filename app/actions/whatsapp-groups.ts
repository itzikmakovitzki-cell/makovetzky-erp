"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, WhatsAppDefaultRoute } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import {
  isGreenApiConfigured,
  sendWhatsAppMessage
} from "@/lib/green-api";

// Spec: docs/spec-whatsapp-groups.md (PR-2).
// Outbound to a project's WhatsApp group + admin wiring of orphan groups
// to the right project. The system NEVER auto-sends — every call here
// traces back to an admin button press, same hard rule as PR #52/#53.

export type ConnectGroupResult =
  | { ok: true }
  | { ok: false; error: string };

// Connects an existing ProjectWhatsAppGroup row (orphan, masterDealId=null)
// to a MasterDeal. The orphan row was created by the inbound webhook the
// first time the system saw the group; the admin's job here is just to say
// "this group belongs to this project". Atomic — if the deal is gone or
// already wired, no partial state is written.
export async function connectGroupToProject(args: {
  groupId: string;
  masterDealId: string;
}): Promise<ConnectGroupResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const group = await prisma.projectWhatsAppGroup.findUnique({
      where: { id: args.groupId },
      select: {
        id: true,
        masterDealId: true,
        groupChatId: true,
        groupName: true,
        isActive: true
      }
    });
    if (!group) return { ok: false, error: "הקבוצה לא נמצאה" };
    if (group.masterDealId && group.masterDealId !== args.masterDealId) {
      return { ok: false, error: "הקבוצה כבר משויכת לפרויקט אחר" };
    }
    const deal = await prisma.masterDeal.findFirst({
      where: { id: args.masterDealId, deletedAt: null },
      select: { id: true, name: true, whatsappGroup: { select: { id: true } } }
    });
    if (!deal) return { ok: false, error: "הפרויקט לא נמצא" };
    if (deal.whatsappGroup && deal.whatsappGroup.id !== group.id) {
      return { ok: false, error: "לפרויקט כבר משויכת קבוצה אחרת" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectWhatsAppGroup.update({
        where: { id: group.id },
        data: {
          masterDealId: args.masterDealId,
          connectedById: me.id,
          connectedAt: new Date(),
          isActive: true
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: args.masterDealId,
        action: AuditAction.UPDATE,
        newValue: {
          event: "whatsapp_group_connected",
          groupChatId: group.groupChatId,
          groupName: group.groupName,
          dealName: deal.name
        },
        userId: me.id
      });
    });
    revalidatePath(`/projects/${args.masterDealId}/whatsapp`);
    revalidatePath(`/projects/${args.masterDealId}`);
    revalidatePath("/inbox");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "חיבור הקבוצה נכשל"
    };
  }
}

// Drops the link between a project and its WhatsApp group. The row stays
// (kept as an orphan) so the inbound history isn't lost — the admin can
// re-link it later. isActive flips to false so the outbound button on the
// project disables itself instead of silently keeping the old target.
export async function disconnectGroupFromProject(args: {
  masterDealId: string;
}): Promise<ConnectGroupResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const group = await prisma.projectWhatsAppGroup.findUnique({
      where: { masterDealId: args.masterDealId },
      select: {
        id: true,
        groupChatId: true,
        groupName: true,
        masterDeal: { select: { id: true, name: true } }
      }
    });
    if (!group) return { ok: false, error: "אין קבוצה משויכת לפרויקט" };

    await prisma.$transaction(async (tx) => {
      await tx.projectWhatsAppGroup.update({
        where: { id: group.id },
        data: { masterDealId: null, isActive: false }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: args.masterDealId,
        action: AuditAction.UPDATE,
        newValue: {
          event: "whatsapp_group_disconnected",
          groupChatId: group.groupChatId,
          groupName: group.groupName,
          dealName: group.masterDeal?.name ?? null
        },
        userId: me.id
      });
    });
    revalidatePath(`/projects/${args.masterDealId}/whatsapp`);
    revalidatePath(`/projects/${args.masterDealId}`);
    revalidatePath("/inbox");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ניתוק הקבוצה נכשל"
    };
  }
}

// Flips MasterDeal.whatsappDefaultRoute. GROUP / CLIENT_DIRECT / NONE — see
// spec §3.2. The actual button rendering decides what to show based on this
// + ProjectWhatsAppGroup presence + Client.notificationPreference.
export async function setProjectWhatsAppDefaultRoute(args: {
  masterDealId: string;
  route: WhatsAppDefaultRoute;
}): Promise<ConnectGroupResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const deal = await prisma.masterDeal.findFirst({
      where: { id: args.masterDealId, deletedAt: null },
      select: { id: true, name: true, whatsappDefaultRoute: true }
    });
    if (!deal) return { ok: false, error: "הפרויקט לא נמצא" };
    if (deal.whatsappDefaultRoute === args.route) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.masterDeal.update({
        where: { id: args.masterDealId },
        data: { whatsappDefaultRoute: args.route }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: args.masterDealId,
        action: AuditAction.UPDATE,
        oldValue: { whatsappDefaultRoute: deal.whatsappDefaultRoute },
        newValue: { whatsappDefaultRoute: args.route },
        userId: me.id
      });
    });
    revalidatePath(`/projects/${args.masterDealId}/whatsapp`);
    revalidatePath(`/projects/${args.masterDealId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "עדכון יעד ברירת המחדל נכשל"
    };
  }
}

// Block 22: per-group "capture every message" toggle. When ON, the green-api
// webhook ingests every inbound file/message in this group as a
// PendingDocument, no @system mention required. Audit-logged on each flip.
export async function setGroupCaptureAllFiles(args: {
  masterDealId: string;
  captureAllFiles: boolean;
}): Promise<ConnectGroupResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const group = await prisma.projectWhatsAppGroup.findFirst({
      where: { masterDealId: args.masterDealId, isActive: true },
      select: {
        id: true,
        groupChatId: true,
        captureAllFiles: true
      }
    });
    if (!group) return { ok: false, error: "אין קבוצת WhatsApp מחוברת לפרויקט" };
    if (group.captureAllFiles === args.captureAllFiles) return { ok: true };

    await prisma.$transaction(async (tx) => {
      await tx.projectWhatsAppGroup.update({
        where: { id: group.id },
        data: { captureAllFiles: args.captureAllFiles }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: args.masterDealId,
        action: AuditAction.UPDATE,
        oldValue: {
          event: "whatsapp_group_capture_all",
          captureAllFiles: group.captureAllFiles
        },
        newValue: {
          event: "whatsapp_group_capture_all",
          groupChatId: group.groupChatId,
          captureAllFiles: args.captureAllFiles
        },
        userId: me.id
      });
    });
    revalidatePath(`/projects/${args.masterDealId}/whatsapp`);
    revalidatePath(`/projects/${args.masterDealId}`);
    revalidatePath("/settings/whatsapp");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "עדכון מצב לכידה נכשל"
    };
  }
}

export type SendProjectGroupResult =
  | { ok: true; via: "green-api"; idMessage: string }
  | { ok: false; error: string };

// Sends a text message to the project's connected WhatsApp group via Green
// API. Spec §5.1: groups have no wa.me equivalent, so unlike the
// client-direct path we don't fall back to a deeplink — if Green API isn't
// configured or fails, the admin gets an explicit error. Every successful
// send writes an AuditLog row (entityType=MASTER_DEAL, event=
// whatsapp_group_sent) so the PR-3 timeline can read history from there
// without a new table.
export async function sendProjectGroupMessage(args: {
  masterDealId: string;
  message: string;
}): Promise<SendProjectGroupResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const trimmed = args.message.trim();
    if (!trimmed) return { ok: false, error: "ההודעה ריקה" };

    const deal = await prisma.masterDeal.findFirst({
      where: { id: args.masterDealId, deletedAt: null },
      select: {
        id: true,
        name: true,
        whatsappDefaultRoute: true,
        whatsappGroup: {
          select: {
            id: true,
            groupChatId: true,
            groupName: true,
            isActive: true
          }
        }
      }
    });
    if (!deal) return { ok: false, error: "הפרויקט לא נמצא" };
    if (deal.whatsappDefaultRoute === "NONE") {
      return { ok: false, error: "שליחת WhatsApp כבויה לפרויקט הזה" };
    }
    const group = deal.whatsappGroup;
    if (!group || !group.isActive) {
      return { ok: false, error: "לא קיימת קבוצה פעילה משויכת לפרויקט" };
    }
    if (!isGreenApiConfigured()) {
      return {
        ok: false,
        error: "Green API לא מוגדר — שליחה לקבוצה אפשרית רק דרך Green API"
      };
    }

    // sendWhatsAppMessage normalizes phone numbers, but a groupChatId
    // already comes in the "972...@g.us" form. Pass it straight through by
    // hitting Green API directly here — phoneToChatId would mangle the
    // group suffix.
    const idInstance = process.env.GREEN_API_ID_INSTANCE;
    const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
    if (!idInstance || !apiTokenInstance) {
      return { ok: false, error: "Green API לא מוגדר במערכת" };
    }
    const url = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: group.groupChatId, message: trimmed }),
        signal: AbortSignal.timeout(15_000)
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.$transaction(async (tx) => {
        await logAudit(tx, {
          entityType: AuditEntity.MASTER_DEAL,
          entityId: args.masterDealId,
          action: AuditAction.UPDATE,
          newValue: {
            event: "whatsapp_group_send_failed",
            transport: "green-api",
            groupChatId: group.groupChatId,
            groupName: group.groupName,
            error: `שגיאת רשת: ${msg}`,
            message: trimmed,
            dealName: deal.name
          },
          userId: me.id
        });
      });
      return { ok: false, error: `שגיאת רשת מול Green API: ${msg}` };
    }

    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        // status alone suffices for the error message
      }
      const error = `Green API החזיר ${res.status}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`;
      await prisma.$transaction(async (tx) => {
        await logAudit(tx, {
          entityType: AuditEntity.MASTER_DEAL,
          entityId: args.masterDealId,
          action: AuditAction.UPDATE,
          newValue: {
            event: "whatsapp_group_send_failed",
            transport: "green-api",
            groupChatId: group.groupChatId,
            groupName: group.groupName,
            error,
            message: trimmed,
            dealName: deal.name
          },
          userId: me.id
        });
      });
      return { ok: false, error };
    }

    const body = (await res.json()) as { idMessage?: string };
    if (!body.idMessage) {
      return { ok: false, error: "Green API החזיר תגובה ללא idMessage" };
    }

    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: args.masterDealId,
        action: AuditAction.UPDATE,
        newValue: {
          event: "whatsapp_group_sent",
          transport: "green-api",
          idMessage: body.idMessage,
          groupChatId: group.groupChatId,
          groupName: group.groupName,
          message: trimmed,
          dealName: deal.name
        },
        userId: me.id
      });
    });
    revalidatePath(`/projects/${args.masterDealId}/whatsapp`);
    return { ok: true, via: "green-api", idMessage: body.idMessage };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "השליחה נכשלה"
    };
  }
}

// Mirrors checkGreenApiConfigured in app/actions/clients.ts — env vars stay
// server-side; the UI calls this on mount to decide what the send button
// should advertise.
export async function checkGreenApiConfiguredForGroups(): Promise<{
  configured: boolean;
}> {
  return { configured: isGreenApiConfigured() };
}

// Used by the "connect group" wizard (spec §6.1) and by /inbox to render
// the orphan list. Returns rows that don't yet belong to any project,
// newest first.
export type OrphanGroup = {
  id: string;
  groupChatId: string;
  groupName: string | null;
  createdAt: Date;
};

export async function listOrphanWhatsAppGroups(): Promise<OrphanGroup[]> {
  await requireRole(["ADMIN"]);
  const rows = await prisma.projectWhatsAppGroup.findMany({
    where: { masterDealId: null },
    select: {
      id: true,
      groupChatId: true,
      groupName: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
  return rows;
}
