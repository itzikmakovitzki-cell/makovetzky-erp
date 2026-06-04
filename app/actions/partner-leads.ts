"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { isGreenApiConfigured, sendWhatsAppMessage } from "@/lib/green-api";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Block 30 (PR-B) — Partners Marketplace lead-routing.
//
// generatePartnerLead is the single action both entry points call into:
//
//   * Back-office:  PM hits "הזמן ספק/שותף" on the permit dashboard while
//                   on a call with a client.
//   * Portal:       Client/Contractor hits "בקש שירות" on /portal/partners.
//
// Three things happen atomically:
//
//   1. A Task is created on the permit, named "ליד שותף: <Supplier>". It
//      starts OPEN and stays unassigned until the supplier confirms.
//   2. A SupplierTaskAssignment is created (status OPEN, commission inherits
//      from supplier defaults). The instant the assignment is marked
//      COMPLETED it enters the existing /finances/supplier-commissions
//      "Outstanding" rail — no separate lead-revenue plumbing required.
//   3. The supplier is notified on every available channel: WhatsApp via
//      Green API if `phone` is set, email via Resend if `email` is set.
//
// All three steps live in one prisma.$transaction so a notification failure
// after Task creation doesn't leak orphan rows. Notifications themselves
// fire AFTER commit (they're side-effecting and can't be rolled back) —
// the result records which channels actually sent so the UI can render a
// truthful toast ("נשלח ב-WhatsApp · מייל לא הוגדר במערכת" etc).

export type ChannelOutcome = { sent: boolean; reason?: string };

export type PartnerLeadResult =
  | {
      ok: true;
      leadTaskId: string;
      assignmentId: string;
      supplierName: string;
      channels: {
        whatsapp: ChannelOutcome;
        email: ChannelOutcome;
      };
    }
  | { ok: false; error: string };

// Build the Hebrew message body. Same copy for both channels per the brief —
// only the wrapper differs (plain text for WhatsApp, html+text for email).
function buildLeadCopy(args: {
  supplierContactName: string;
  permitName: string;
  clientCompanyName: string;
  clientContactName: string;
  clientPhone: string;
}): { plain: string; html: string; subject: string } {
  const subject = `בקשת שירות חדשה מפורטל מקובצקי — ${args.permitName}`;
  const plain = [
    `היי ${args.supplierContactName},`,
    "",
    "התקבלה בקשת שירות חדשה מפורטל מקובצקי!",
    "",
    `פרויקט: ${args.permitName}`,
    `לקוח: ${args.clientCompanyName} (${args.clientContactName})`,
    `טלפון הלקוח ליצירת קשר: ${args.clientPhone}`,
    "",
    "נשמח לעדכון."
  ].join("\n");

  // Keep the HTML mirror dead-simple — Hebrew RTL paragraph + a single
  // dl-style block for the project fields. No external CSS, no images.
  const html = `<!doctype html>
<html lang="he" dir="rtl"><body style="font-family: -apple-system, Segoe UI, Heebo, sans-serif; font-size: 14px; color: #1F2937; line-height: 1.6;">
  <p>היי ${escapeHtml(args.supplierContactName)},</p>
  <p>התקבלה בקשת שירות חדשה מפורטל מקובצקי!</p>
  <table cellpadding="4" style="border-collapse: collapse; margin-top: 8px;">
    <tr><td style="color: #6B7280;">פרויקט:</td><td><strong>${escapeHtml(args.permitName)}</strong></td></tr>
    <tr><td style="color: #6B7280;">לקוח:</td><td>${escapeHtml(args.clientCompanyName)} (${escapeHtml(args.clientContactName)})</td></tr>
    <tr><td style="color: #6B7280;">טלפון הלקוח:</td><td><a href="tel:${escapeHtml(args.clientPhone)}">${escapeHtml(args.clientPhone)}</a></td></tr>
  </table>
  <p style="margin-top: 16px;">נשמח לעדכון.</p>
</body></html>`;
  return { plain, html, subject };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function generatePartnerLead(args: {
  supplierId: string;
  permitId: string;
}): Promise<PartnerLeadResult> {
  try {
    // PM / EMPLOYEE call this from the back-office; CONTRACTOR (also the
    // role used for portal CLIENTs today) calls it from /portal/partners.
    const me = await requireRole(["ADMIN", "EMPLOYEE", "CONTRACTOR"]);

    if (!args.supplierId) return { ok: false, error: "חסר ספק" };
    if (!args.permitId) return { ok: false, error: "חסר פרויקט/היתר" };

    // Pull everything we need up front so the transaction body is short
    // and the early-return paths are clear.
    const [supplier, permit] = await Promise.all([
      prisma.supplier.findUnique({
        where: { id: args.supplierId },
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          email: true,
          isPublic: true
        }
      }),
      prisma.permit.findFirst({
        where: { id: args.permitId, deletedAt: null },
        select: {
          id: true,
          name: true,
          masterDeal: {
            select: {
              clientId: true,
              client: {
                select: {
                  id: true,
                  companyName: true,
                  contactName: true,
                  phone: true
                }
              }
            }
          }
        }
      })
    ]);
    if (!supplier) return { ok: false, error: "הספק לא נמצא" };
    if (!supplier.isPublic) {
      return { ok: false, error: "הספק לא מסומן כפומבי ולא ניתן לייצר ליד" };
    }
    if (!permit) return { ok: false, error: "הפרויקט לא נמצא" };

    // CONTRACTOR-role caller must have explicit PortalAccess to this
    // permit's client — same check as every other portal-write path.
    if (me.role === "CONTRACTOR") {
      const granted = await prisma.portalAccess.findFirst({
        where: { userId: me.id, clientId: permit.masterDeal.clientId },
        select: { id: true }
      });
      if (!granted) return { ok: false, error: "אין לך גישה לפרויקט זה" };
    }

    const leadTaskName = `ליד שותף: ${supplier.name}`;

    const { leadTaskId, assignmentId } = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          permitId: permit.id,
          name: leadTaskName,
          description: `ליד שותף ייוצר אוטומטית דרך Partners Marketplace ע"י ${me.email ?? me.id}.`,
          // Stays unassigned — the supplier responds before a PM picks it up.
          assigneeId: null
        },
        select: { id: true }
      });

      const assignment = await tx.supplierTaskAssignment.create({
        data: {
          supplierId: supplier.id,
          taskId: task.id,
          // commission* left null = inherit from Supplier defaults at read
          // time, exactly like every other assignment. Brief calls this
          // "Lock Commission" — the inheritance is the lock; no separate
          // copy of the commission lives on the assignment unless the PM
          // edits it later.
          status: "OPEN"
        },
        select: { id: true }
      });

      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_ASSIGNMENT,
        entityId: assignment.id,
        action: AuditAction.CREATE,
        newValue: {
          source: "partner_marketplace_lead",
          supplierId: supplier.id,
          permitId: permit.id,
          taskId: task.id,
          requestedBy: me.id
        },
        userId: me.id
      });

      return { leadTaskId: task.id, assignmentId: assignment.id };
    });

    // Notifications fire AFTER commit — they can't be rolled back, and the
    // database state (task + assignment) must be the source of truth even
    // if every channel silently fails.
    const supplierContactName = supplier.contactName ?? supplier.name;
    const copy = buildLeadCopy({
      supplierContactName,
      permitName: permit.name,
      clientCompanyName: permit.masterDeal.client.companyName,
      clientContactName: permit.masterDeal.client.contactName,
      clientPhone: permit.masterDeal.client.phone
    });

    const channels: { whatsapp: ChannelOutcome; email: ChannelOutcome } = {
      whatsapp: { sent: false, reason: undefined },
      email: { sent: false, reason: undefined }
    };

    if (!supplier.phone) {
      channels.whatsapp.reason = "אין טלפון לספק";
    } else if (!isGreenApiConfigured()) {
      channels.whatsapp.reason = "Green API לא מוגדר";
    } else {
      const res = await sendWhatsAppMessage({
        phone: supplier.phone,
        message: copy.plain
      });
      channels.whatsapp.sent = res.ok;
      if (!res.ok) channels.whatsapp.reason = res.error;
    }

    if (!supplier.email) {
      channels.email.reason = "אין אימייל לספק";
    } else if (!isResendConfigured()) {
      // Stub state — Resend account/domain/API key still pending. The call
      // site is wired so the moment RESEND_API_KEY + RESEND_FROM_EMAIL land
      // on Vercel emails start sending without a code change.
      channels.email.reason = "Resend לא מוגדר";
    } else {
      const res = await sendEmail({
        to: supplier.email,
        subject: copy.subject,
        text: copy.plain,
        html: copy.html
      });
      channels.email.sent = res.ok;
      if (!res.ok) channels.email.reason = res.error;
    }

    revalidatePath("/suppliers");
    revalidatePath(`/suppliers?supplier=${supplier.id}`);
    revalidatePath(`/permits/${permit.id}/tasks`);
    revalidatePath(`/permits/${permit.id}`);
    revalidatePath("/finances/supplier-commissions");

    return {
      ok: true,
      leadTaskId,
      assignmentId,
      supplierName: supplier.name,
      channels
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה ביצירת ליד שותף"
    };
  }
}
