// Block 38 — Smart Milestone Upsell Trigger for Form 4 ("טופס 4").
//
// When the last "טופס 4" task on a permit flips to COMPLETED — or when
// the permit otherwise hits 100% with at least one Form-4 task on it —
// fire a one-shot consumer upsell to the client *iff* their clientType
// is PRIVATE. The message points them at the Partners Marketplace
// "home entry" bundle (internet, gas, cleaning, …) so the moment the
// keys swap the client already has the offers in hand.
//
// Why this lives outside `updateTaskStatus`:
//   * The hook needs to fire AFTER the parent transaction commits — a
//     send to Green API or Resend that throws should never roll back
//     the user's task-status change.
//   * Detection is multi-step (find Form-4 tasks, check completion,
//     check de-dupe marker) and it's noisy inside the already-large
//     updateTaskStatus.
//
// Idempotence: the upsell is logged via AuditLog with a known marker
// ("event": "form4_upsell_dispatched") so re-running the trigger never
// double-sends. The de-dupe check is "has this permit ever fired one".

import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuditEntity, logAudit } from "@/lib/audit";
import { isGreenApiConfigured, sendWhatsAppMessage } from "@/lib/green-api";
import { isResendConfigured, sendEmail } from "@/lib/resend";

// Matches both the canonical Hebrew name ("טופס 4") and the common
// authority abbreviation ("טופס4" / "form 4"). Case-insensitive.
const FORM4_TASK_PATTERNS = [/טופס\s*4/i, /form\s*4/i];

function isForm4TaskName(name: string): boolean {
  return FORM4_TASK_PATTERNS.some((p) => p.test(name));
}

function buildUpsellCopy(args: {
  clientContactName: string;
  permitName: string;
  portalUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = "מזל טוב על קבלת טופס 4! זה הזמן לדאוג לתשתית הבית 🎉";
  const text = [
    `היי ${args.clientContactName},`,
    "",
    `מזל טוב על קבלת טופס 4 לפרויקט "${args.permitName}"!`,
    "",
    "רגע לפני שנכנסים לבית — זה הזמן לדאוג לתשתית.",
    "",
    "היכנסו לפורטל מקובצקי ותקבלו במחיר מיוחד לחברי המאגר:",
    "  • אינטרנט של HOT",
    "  • התקנת פזגז",
    "  • ניקיון כניסה לבית",
    "  • ועוד שותפים נבחרים",
    "",
    `${args.portalUrl}`,
    "",
    "צוות מקובצקי — הביורוקרטיה עלינו."
  ].join("\n");

  const html = `<!doctype html>
<html lang="he" dir="rtl"><body style="font-family: -apple-system, Segoe UI, Heebo, sans-serif; font-size: 14px; color: #1F2937; line-height: 1.6; background: #F5F1E8; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="margin: 0 0 12px; font-size: 22px; color: #1F2937;">🎉 מזל טוב על קבלת טופס 4!</h1>
    <p>היי <strong>${escapeHtml(args.clientContactName)}</strong>,</p>
    <p>זכינו להוביל אתכם עד הקו הזה — הפרויקט <strong>${escapeHtml(args.permitName)}</strong> אושר לאכלוס.</p>
    <p style="margin-top: 16px;">רגע לפני שנכנסים לבית — זה הזמן לדאוג לתשתית. במאגר השותפים של מקובצקי מחכה לכם חבילה מלאה במחיר חברים:</p>
    <ul style="padding-inline-start: 20px; margin: 8px 0;">
      <li>אינטרנט של HOT</li>
      <li>התקנת פזגז</li>
      <li>ניקיון כניסה לבית</li>
      <li>ועוד שותפים נבחרים — חשמלאי, אינסטלטור, גינון</li>
    </ul>
    <p style="margin-top: 20px; text-align: center;">
      <a href="${escapeHtml(args.portalUrl)}" style="display: inline-block; padding: 12px 24px; background: #E25822; color: #ffffff; border-radius: 999px; text-decoration: none; font-weight: 600;">
        כניסה לפורטל השותפים ←
      </a>
    </p>
    <p style="margin-top: 24px; color: #6B7280; font-size: 12px;">צוות מקובצקי — הביורוקרטיה עלינו.</p>
  </div>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type UpsellDispatchResult =
  | { ok: true; dispatched: false; reason: string }
  | {
      ok: true;
      dispatched: true;
      channels: {
        whatsapp: { sent: boolean; reason?: string };
        email: { sent: boolean; reason?: string };
      };
    }
  | { ok: false; error: string };

// Call this AFTER the prisma.$transaction that flipped a task to COMPLETED
// has committed. Safe to call on every COMPLETED transition — the trigger
// itself decides whether the conditions are met and self-dedupes.
//
// Conditions to fire (all must hold):
//   1. Permit has at least one task whose name matches the Form-4 pattern.
//   2. Every Form-4 task on the permit is COMPLETED.
//   3. The owning Client.clientType === "PRIVATE".
//   4. No prior `form4_upsell_dispatched` AuditLog entry on this permit.
//
// Returns a structured result so the caller (and the inevitable future test)
// can see exactly which branch fired. Never throws — failures land in the
// audit log so the PM can see what happened.
export async function maybeDispatchForm4Upsell(
  permitId: string,
  userId: string | null
): Promise<UpsellDispatchResult> {
  try {
    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: {
        id: true,
        name: true,
        masterDeal: {
          select: {
            client: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                phone: true,
                email: true,
                clientType: true,
                notificationPreference: true
              }
            }
          }
        },
        tasks: {
          where: { deletedAt: null },
          select: { id: true, name: true, status: true }
        }
      }
    });
    if (!permit) return { ok: false, error: "Permit not found" };

    const form4Tasks = permit.tasks.filter((t) => isForm4TaskName(t.name));
    if (form4Tasks.length === 0) {
      return { ok: true, dispatched: false, reason: "no_form4_tasks_on_permit" };
    }

    const allDone = form4Tasks.every((t) => t.status === "COMPLETED");
    if (!allDone) {
      return { ok: true, dispatched: false, reason: "form4_tasks_not_all_completed" };
    }

    const client = permit.masterDeal.client;
    if (client.clientType !== "PRIVATE") {
      return { ok: true, dispatched: false, reason: "client_not_private" };
    }

    // De-dupe — if we've ever logged a dispatch for this permit, bail.
    const prior = await prisma.auditLog.findFirst({
      where: {
        entityType: AuditEntity.PERMIT,
        entityId: permitId,
        action: AuditAction.STATUS_CHANGE,
        newValue: { path: ["event"], equals: "form4_upsell_dispatched" }
      },
      select: { id: true }
    });
    if (prior) {
      return { ok: true, dispatched: false, reason: "already_dispatched" };
    }

    // Build the copy.
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.makomedia.co.il"}/portal/partners`;
    const copy = buildUpsellCopy({
      clientContactName: client.contactName,
      permitName: permit.name,
      portalUrl
    });

    const channels = {
      whatsapp: { sent: false } as { sent: boolean; reason?: string },
      email: { sent: false } as { sent: boolean; reason?: string }
    };

    // WhatsApp — gated on the client's notification preference. OFF means
    // even an automated milestone notification stays silent.
    if (client.notificationPreference === "OFF") {
      channels.whatsapp.reason = "client_notifications_off";
    } else if (!client.phone) {
      channels.whatsapp.reason = "no_client_phone";
    } else if (!isGreenApiConfigured()) {
      channels.whatsapp.reason = "green_api_not_configured";
    } else {
      const res = await sendWhatsAppMessage({
        phone: client.phone,
        message: copy.text
      });
      channels.whatsapp.sent = res.ok;
      if (!res.ok) channels.whatsapp.reason = res.error;
    }

    // Email — independent transport. Always allowed (transactional /
    // milestone email is not gated on the WhatsApp preference toggle).
    if (!client.email) {
      channels.email.reason = "no_client_email";
    } else if (!isResendConfigured()) {
      channels.email.reason = "resend_not_configured";
    } else {
      const res = await sendEmail({
        to: client.email,
        subject: copy.subject,
        text: copy.text,
        html: copy.html
      });
      channels.email.sent = res.ok;
      if (!res.ok) channels.email.reason = res.error;
    }

    // Mark the dispatch in the audit log so the next COMPLETED of any task
    // on this permit doesn't re-fire. We log unconditionally — even if both
    // transports failed, "we tried" is the state of record.
    await prisma.$transaction(async (tx) => {
      await logAudit(tx, {
        entityType: AuditEntity.PERMIT,
        entityId: permitId,
        action: AuditAction.STATUS_CHANGE,
        newValue: {
          event: "form4_upsell_dispatched",
          permitName: permit.name,
          clientId: client.id,
          clientName: client.companyName,
          clientType: client.clientType,
          channels
        },
        userId
      });
    });

    return { ok: true, dispatched: true, channels };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "unknown_error"
    };
  }
}
