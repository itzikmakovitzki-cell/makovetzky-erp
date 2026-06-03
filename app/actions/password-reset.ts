"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AuditEntity, logAudit } from "@/lib/audit";
import { sendWhatsAppMessage } from "@/lib/green-api";

// Block 28: self-service "forgot password" flow.
//
// Threat model: anyone can hit /forgot-password and submit an email. We
// MUST NOT reveal whether the email exists (account enumeration) — both
// success and "no such email" paths return the same shape and message.
// The link is sent over WhatsApp to the user's `phone` (set by an admin
// at user-creation time), so the email field alone leaks nothing useful.
//
// Token: 32 random bytes, hex-encoded (64 chars). Stored as-is in the DB
// — the URL itself IS the credential, so anyone who can read the DB can
// already do anything. TTL 1 hour. Single-use enforced by setting
// usedAt on consume.

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_MIN_LENGTH = 8;

// Public URL base used to build the reset link sent over WhatsApp.
// Prefer the canonical NEXT_PUBLIC_APP_URL; fall back to VERCEL_URL
// (with the https:// prefix added) for preview deployments.
function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  // Local dev fallback — the link will be useless from a phone but at
  // least developers can see the value in audit logs / console.
  return "http://localhost:3000";
}

// Always-same return shape so the form can't tell hit vs miss.
export type RequestResetResult = { ok: true; message: string } | { ok: false; error: string };

export async function requestPasswordReset(
  email: string
): Promise<RequestResetResult> {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) {
    return { ok: false, error: "יש להזין כתובת אימייל" };
  }

  // Best-effort IP capture for forensics; absent in some Server Action
  // contexts (e.g. local dev without a reverse proxy).
  let issuedIp: string | null = null;
  try {
    const h = await headers();
    issuedIp =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      null;
  } catch {
    // ignore — IP capture is non-essential
  }

  const SUCCESS_MESSAGE =
    "אם הכתובת רשומה במערכת ולמשתמש יש מספר WhatsApp תקין — נשלח קישור איפוס.";

  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, phone: true, isActive: true }
  });

  // Branch silently — don't reveal "no such user" or "user inactive".
  // Audit-log the attempt so an admin can investigate suspicious volume.
  if (!user || !user.isActive || !user.phone || !user.phone.trim()) {
    await logAudit(prisma, {
      entityType: AuditEntity.USER,
      // Use the email as the entityId here — there is no real User row to
      // hang the row off of (or the user is inactive/has no phone). Keeps
      // the log searchable by email.
      entityId: normalized,
      action: AuditAction.UPDATE,
      newValue: {
        event: "password_reset_requested_no_match",
        emailTried: normalized,
        reason: !user
          ? "user_not_found"
          : !user.isActive
            ? "user_inactive"
            : "no_phone_on_file",
        issuedIp
      },
      userId: null
    });
    return { ok: true, message: SUCCESS_MESSAGE };
  }

  // Invalidate any still-valid tokens this user has — only the latest
  // should work. Keeps "request twice, click first" from being a thing.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() }
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt, issuedIp }
    });
    await logAudit(tx, {
      entityType: AuditEntity.USER,
      entityId: user.id,
      action: AuditAction.UPDATE,
      newValue: {
        event: "password_reset_requested",
        targetName: user.name,
        // Token itself is intentionally NOT logged — only the fact that
        // a token was issued. The link is delivered out-of-band via WA.
        expiresAt: expiresAt.toISOString(),
        issuedIp
      },
      userId: null
    });
  });

  const link = `${getAppBaseUrl()}/reset-password/${token}`;
  const message = [
    `שלום ${user.name},`,
    "",
    "התקבלה בקשה לאיפוס סיסמה לחשבון שלך במערכת מקובצקי.",
    "לחץ על הקישור הבא כדי לקבוע סיסמה חדשה (תקף לשעה):",
    "",
    link,
    "",
    "אם לא ביקשת את האיפוס — התעלם מההודעה והסיסמה הקיימת תישאר ללא שינוי."
  ].join("\n");

  const sendResult = await sendWhatsAppMessage({
    phone: user.phone,
    message
  });

  // Audit-log the delivery outcome separately so an admin can see whether
  // Green API actually accepted the send (and the user didn't just claim
  // "I never got the link").
  await logAudit(prisma, {
    entityType: AuditEntity.USER,
    entityId: user.id,
    action: AuditAction.UPDATE,
    newValue: sendResult.ok
      ? {
          event: "password_reset_link_sent",
          targetName: user.name,
          transport: "green-api",
          idMessage: sendResult.idMessage
        }
      : {
          event: "password_reset_link_send_failed",
          targetName: user.name,
          transport: "green-api",
          error: sendResult.error
        },
    userId: null
  });

  // Even on send failure, return the generic success message — the user
  // sees the same screen either way. They (or an admin) can investigate
  // via the audit log if the WhatsApp never arrives.
  return { ok: true, message: SUCCESS_MESSAGE };
}

// =============================================================
// Consume a token + set a new password.
// =============================================================

export type ConsumeResetResult = { ok: true } | { ok: false; error: string };

export async function consumePasswordReset(args: {
  token: string;
  newPassword: string;
}): Promise<ConsumeResetResult> {
  const token = String(args.token ?? "").trim();
  const newPassword = String(args.newPassword ?? "");

  if (!token) return { ok: false, error: "חסר קוד איפוס" };
  if (!newPassword || newPassword.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      error: `הסיסמה חייבת להיות לפחות ${PASSWORD_MIN_LENGTH} תווים`
    };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, name: true, email: true, isActive: true } }
    }
  });

  if (!record) return { ok: false, error: "קישור איפוס לא חוקי" };
  if (record.usedAt) return { ok: false, error: "קישור איפוס כבר נוצל" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "קישור איפוס פג תוקף" };
  }
  if (!record.user.isActive) {
    // Safety: don't let a token issued before deactivation become a foothold.
    return { ok: false, error: "החשבון לא פעיל" };
  }

  const newHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    });
    await tx.user.update({
      where: { id: record.user.id },
      data: { passwordHash: newHash }
    });
    await logAudit(tx, {
      entityType: AuditEntity.USER,
      entityId: record.user.id,
      action: AuditAction.UPDATE,
      newValue: {
        event: "password_reset_via_token",
        targetName: record.user.name,
        targetEmail: record.user.email
      },
      userId: record.user.id
    });
  });

  return { ok: true };
}
