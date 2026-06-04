import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isGreenApiConfigured,
  sendWhatsAppMessage
} from "@/lib/green-api";
import { COMPANY_DETAILS } from "@/lib/proposal-template";

// Daily Vercel cron — finds V2 SENT proposals that are 5+ days old, still
// unsigned, not yet reminded, and not expired. Sends a single WhatsApp nudge
// to the customer with the signing link. Idempotent via reminderSentAt.
//
// Triggered from vercel.json; the secret check ensures only the Vercel cron
// platform (or an admin with the env var) can invoke it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const REMINDER_AFTER_DAYS = 5;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") || "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : new URL(req.url).searchParams.get("secret") || "";
  if (!expected || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isGreenApiConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "green-api not configured",
      processed: 0
    });
  }

  const now = new Date();
  const cutoff = new Date(
    now.getTime() - REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000
  );

  // SENT, V2, no reminder yet, not expired, has a phone, sent at least N days ago.
  const due = await prisma.proposal.findMany({
    where: {
      status: "SENT",
      templateVersion: { gte: 2 },
      deletedAt: null,
      reminderSentAt: null,
      sentAt: { lte: cutoff },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
    },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      quoteTitle: true,
      sentAt: true,
      expiresAt: true
    }
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const p of due) {
    if (!p.customerPhone) continue;
    const link = baseUrl
      ? `${baseUrl}/quote/${p.id}`
      : `/quote/${p.id}`;
    const title = p.quoteTitle || "הצעת מחיר";
    const expiryNote = p.expiresAt
      ? `\n\nשים לב: ההצעה תקפה עד ${p.expiresAt.toLocaleDateString("he-IL")}.`
      : "";
    const message =
      `שלום ${p.customerName},\n\n` +
      `רצינו להזכיר לך שההצעה "${title}" ממתינה לאישור וחתימה.\n\n` +
      `${link}` +
      expiryNote +
      `\n\n${COMPANY_DETAILS.brandName} — ${COMPANY_DETAILS.brandTagline}`;

    const res = await sendWhatsAppMessage({
      phone: p.customerPhone,
      message
    });
    if (res.ok) {
      await prisma.proposal.update({
        where: { id: p.id },
        data: { reminderSentAt: new Date() }
      });
      results.push({ id: p.id, ok: true });
    } else {
      results.push({ id: p.id, ok: false, error: res.error });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results
  });
}
