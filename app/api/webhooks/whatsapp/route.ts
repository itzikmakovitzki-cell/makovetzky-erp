import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Generic, provider-agnostic WhatsApp webhook for /api/webhooks/whatsapp.
// Suited for providers that POST a plain JSON envelope with sender + body +
// optional media URL (Twilio, Green API, MessageBird, custom bridges, etc.).
//
// For the Meta WhatsApp Cloud API specifically, see /api/whatsapp/webhook
// which implements the Meta handshake + signed payload format.
//
// Node runtime because we touch Prisma (Postgres pool) and may read large
// bodies. Edge can't do either reliably.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenericPayload = {
  from?: string;
  body?: string;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  messageId?: string; // optional — providers that send one get idempotency
  senderName?: string;
};

const MESSAGE_PREVIEW_LIMIT = 500;

export async function POST(req: NextRequest) {
  // 1. Require a configured secret. We do this first so an unconfigured
  //    server returns 503 (not 401) — easier to diagnose during setup.
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Webhook not configured", detail: "WHATSAPP_WEBHOOK_SECRET is missing on the server" },
      { status: 503 }
    );
  }

  // 2. Accept the secret from either an HTTP header (`X-Webhook-Secret`,
  //    standard) or a query param (`?secret=…`, useful for providers that
  //    can't customize headers).
  const providedSecret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse JSON. We accept the body once as text so a malformed payload
  //    yields a clean 400 instead of a runtime crash.
  let payload: GenericPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const from = String(payload.from ?? "").trim();
  const body = String(payload.body ?? "").trim();
  const mediaUrl = String(payload.mediaUrl ?? "").trim();
  const fileName = (payload.fileName ?? "").trim() || null;
  const mimeType = (payload.mimeType ?? "").trim() || null;
  const messageId = (payload.messageId ?? "").trim() || null;
  const senderName = (payload.senderName ?? "").trim() || null;

  if (!from) {
    return NextResponse.json(
      { error: "Missing required field 'from'" },
      { status: 400 }
    );
  }
  if (!body && !mediaUrl) {
    return NextResponse.json(
      { error: "Either 'body' or 'mediaUrl' must be provided" },
      { status: 400 }
    );
  }

  // 4. Idempotency — if the provider gives a messageId and we've already
  //    seen it, return 200 with `dedupe: true` so the provider doesn't keep
  //    retrying. We tag rawMessage with [id:<messageId>] for lookup.
  if (messageId) {
    const existing = await prisma.pendingDocument.findFirst({
      where: { rawMessage: { contains: `[id:${messageId}]` } },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        dedupe: true,
        pendingDocumentId: existing.id
      });
    }
  }

  // 5. Compose the inbox row. Sender display normalizes the phone format —
  //    incoming digits-only numbers get a "+" prefix; numbers already with
  //    "+" pass through.
  const phoneFormatted = from.startsWith("+") ? from : `+${from}`;
  const senderInfo = senderName
    ? `WhatsApp — ${senderName} (${phoneFormatted})`
    : `WhatsApp — ${phoneFormatted}`;

  // For text-only messages, fileUrl is empty string (the schema allows it).
  // For media messages, we store the URL as-is. The inbox UI's isStoragePath
  // helper distinguishes external URLs (https://…) from our Supabase paths
  // and renders external ones unsigned. If you want the file re-hosted in
  // our Storage bucket, mirror the download+upload pattern from
  // app/api/whatsapp/webhook (Meta variant).
  const rawMessageParts: string[] = [];
  if (messageId) rawMessageParts.push(`[id:${messageId}]`);
  if (body) {
    rawMessageParts.push(
      body.length > MESSAGE_PREVIEW_LIMIT
        ? body.slice(0, MESSAGE_PREVIEW_LIMIT) + "…"
        : body
    );
  }
  const rawMessage = rawMessageParts.join(" ") || null;

  const pending = await prisma.pendingDocument.create({
    data: {
      sourceChannel: "WHATSAPP",
      senderInfo,
      fileUrl: mediaUrl || "",
      fileName: fileName ?? (mediaUrl ? guessFileNameFromUrl(mediaUrl) : null),
      mimeType,
      rawMessage,
      status: "PENDING"
    }
  });

  return NextResponse.json({ ok: true, pendingDocumentId: pending.id });
}

function guessFileNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}
