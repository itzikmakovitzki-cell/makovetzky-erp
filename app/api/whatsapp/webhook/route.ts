import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPendingStoragePath, uploadToStorage } from "@/lib/supabase-storage";
import {
  deriveFileName,
  downloadWhatsAppMedia,
  getWhatsAppConfig,
  truncate,
  verifyMetaSignature
} from "@/lib/whatsapp";

// Cloud API webhooks run on Node (Edge can't do HMAC + Supabase service-role).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET handler — Meta's webhook subscription handshake. We echo back the
// `hub.challenge` value only when `hub.verify_token` matches our configured
// secret, otherwise we 403. This is what Meta's "Verify and save" button hits.
export async function GET(req: NextRequest) {
  const { verifyToken } = getWhatsAppConfig();
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (!verifyToken) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

type WhatsAppMessage = {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string; voice?: boolean };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  voice?: { id: string; mime_type: string };
};

type WhatsAppContact = { wa_id: string; profile?: { name?: string } };

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: WhatsAppContact[];
        messages?: WhatsAppMessage[];
        statuses?: Array<{ status: string; recipient_id: string }>;
      };
    }>;
  }>;
};

// POST handler — every inbound WhatsApp event from Meta. We must return 2xx
// quickly (Meta retries on non-2xx), so per-message errors are logged but the
// response is always 200 unless the request itself is malformed.
export async function POST(req: NextRequest) {
  const { verifyToken, accessToken, phoneNumberId, appSecret } = getWhatsAppConfig();
  if (!verifyToken || !accessToken || !phoneNumberId) {
    // Don't 5xx — Meta would retry. Just accept and drop until we're configured.
    return NextResponse.json({ ok: true, skipped: "not_configured" });
  }

  const rawBody = await req.text();
  if (appSecret) {
    const ok = verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"));
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const results: Array<{ id: string; status: "ok" | "skipped" | "error"; reason?: string }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      // Delivery/read receipts and template-callback events arrive here too.
      // Only process actual user messages.
      if (!value.messages?.length) continue;
      const contacts = value.contacts ?? [];
      for (const msg of value.messages) {
        try {
          await processMessage(msg, contacts);
          results.push({ id: msg.id, status: "ok" });
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          console.error("[whatsapp-webhook] message processing failed", msg.id, reason);
          results.push({ id: msg.id, status: "error", reason });
        }
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}

async function processMessage(msg: WhatsAppMessage, contacts: WhatsAppContact[]): Promise<void> {
  const contact = contacts.find((c) => c.wa_id === msg.from);
  const senderName = contact?.profile?.name ?? null;
  const senderInfo = senderName ? `WhatsApp — ${senderName} (+${msg.from})` : `WhatsApp — +${msg.from}`;

  // Idempotency: WhatsApp may redeliver on retry. Skip if the message id is
  // already stored anywhere in rawMessage. Cheap enough to scan since the
  // inbox is small and PENDING-bound.
  const existing = await prisma.pendingDocument.findFirst({
    where: { rawMessage: { contains: `[wa:${msg.id}]` } },
    select: { id: true }
  });
  if (existing) return;

  // Text-only messages become PendingDocuments with no file — the inbox UI
  // already handles fileUrl-less notes (rawMessage is the body).
  if (msg.type === "text" && msg.text?.body) {
    await prisma.pendingDocument.create({
      data: {
        sourceChannel: "WHATSAPP",
        senderInfo,
        fileUrl: "",
        fileName: null,
        mimeType: null,
        rawMessage: `[wa:${msg.id}] ${truncate(msg.text.body)}`,
        status: "PENDING"
      }
    });
    return;
  }

  const media = pickMedia(msg);
  if (!media) {
    // Unsupported message type (location, reaction, etc.) — record as a note
    // so nothing is silently dropped.
    await prisma.pendingDocument.create({
      data: {
        sourceChannel: "WHATSAPP",
        senderInfo,
        fileUrl: "",
        fileName: null,
        mimeType: null,
        rawMessage: `[wa:${msg.id}] (סוג הודעה לא נתמך: ${msg.type})`,
        status: "PENDING"
      }
    });
    return;
  }

  const { buffer, info } = await downloadWhatsAppMedia(media.mediaId, media.fileName);
  const fileName = deriveFileName(msg.type, info.mimeType || media.mimeType, info.fileName);
  const path = buildPendingStoragePath(fileName);
  await uploadToStorage(buffer, path, info.mimeType || media.mimeType);

  await prisma.pendingDocument.create({
    data: {
      sourceChannel: "WHATSAPP",
      senderInfo,
      fileUrl: path,
      fileName,
      mimeType: info.mimeType || media.mimeType,
      rawMessage: media.caption ? `[wa:${msg.id}] ${truncate(media.caption)}` : `[wa:${msg.id}]`,
      status: "PENDING"
    }
  });
}

function pickMedia(msg: WhatsAppMessage): { mediaId: string; mimeType: string; fileName: string | null; caption: string | null } | null {
  if (msg.document) return { mediaId: msg.document.id, mimeType: msg.document.mime_type, fileName: msg.document.filename ?? null, caption: msg.document.caption ?? null };
  if (msg.image) return { mediaId: msg.image.id, mimeType: msg.image.mime_type, fileName: null, caption: msg.image.caption ?? null };
  if (msg.video) return { mediaId: msg.video.id, mimeType: msg.video.mime_type, fileName: null, caption: msg.video.caption ?? null };
  if (msg.audio) return { mediaId: msg.audio.id, mimeType: msg.audio.mime_type, fileName: null, caption: null };
  if (msg.voice) return { mediaId: msg.voice.id, mimeType: msg.voice.mime_type, fileName: null, caption: null };
  if (msg.sticker) return { mediaId: msg.sticker.id, mimeType: msg.sticker.mime_type, fileName: null, caption: null };
  return null;
}
