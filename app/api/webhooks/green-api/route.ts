import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPendingStoragePath, uploadToStorage } from "@/lib/supabase-storage";
import {
  deriveGreenApiFileName,
  downloadGreenApiMedia,
  normalizeGreenApiPayload,
  type GreenApiWebhook
} from "@/lib/green-api";

// Green-API.com webhook adapter. Translates their fixed payload format into
// a PendingDocument row (sourceChannel=WHATSAPP), mirroring what the Meta
// Cloud API handler at /api/whatsapp/webhook does — but for the QR-scan flow
// that does not require Meta Business verification.
//
// Auth: Green API webhooks have no built-in signature. We require the same
// WHATSAPP_WEBHOOK_SECRET used by /api/webhooks/whatsapp, accepted either as
// X-Webhook-Secret header or ?secret= query param. Configure the secret in
// the URL when pasting it into Green API's "outgoingMessageWebhook" field.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_PREVIEW_LIMIT = 4000;

export async function POST(req: NextRequest) {
  const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Webhook not configured", detail: "WHATSAPP_WEBHOOK_SECRET missing" },
      { status: 503 }
    );
  }
  const providedSecret =
    req.headers.get("x-webhook-secret") ??
    req.nextUrl.searchParams.get("secret") ??
    "";
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: GreenApiWebhook;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = normalizeGreenApiPayload(payload);
  // Non-inbound events (statuses, outgoing echoes, instance state changes)
  // are acknowledged with 200 so Green API doesn't keep retrying.
  if (!normalized) {
    return NextResponse.json({ ok: true, skipped: payload.typeWebhook ?? "unknown" });
  }

  if (!normalized.fromPhone) {
    return NextResponse.json({ ok: true, skipped: "no_sender" });
  }

  // Idempotency: Green API can redeliver. Tag rawMessage with [green:<id>]
  // and dedupe on subsequent webhooks.
  if (normalized.idMessage) {
    const existing = await prisma.pendingDocument.findFirst({
      where: { rawMessage: { contains: `[green:${normalized.idMessage}]` } },
      select: { id: true }
    });
    if (existing) {
      return NextResponse.json({ ok: true, dedupe: true, pendingDocumentId: existing.id });
    }
  }

  const phoneFormatted = `+${normalized.fromPhone}`;
  const senderInfo = normalized.senderName
    ? `WhatsApp — ${normalized.senderName} (${phoneFormatted})`
    : `WhatsApp — ${phoneFormatted}`;

  const idTag = normalized.idMessage ? `[green:${normalized.idMessage}]` : null;

  try {
    if (normalized.kind === "text") {
      const text = normalized.text ?? "";
      const truncated = text.length > MESSAGE_PREVIEW_LIMIT ? text.slice(0, MESSAGE_PREVIEW_LIMIT) + "…" : text;
      const rawMessage = [idTag, truncated].filter(Boolean).join(" ") || idTag;
      const pending = await prisma.pendingDocument.create({
        data: {
          sourceChannel: "WHATSAPP",
          senderInfo,
          fileUrl: "",
          fileName: null,
          mimeType: null,
          rawMessage,
          status: "PENDING"
        }
      });
      return NextResponse.json({ ok: true, pendingDocumentId: pending.id });
    }

    if (normalized.kind === "media" && normalized.media) {
      const { buffer, mimeType: headerMime } = await downloadGreenApiMedia(normalized.media.downloadUrl);
      const mimeType = normalized.media.mimeType || headerMime || null;
      const messageType = payload.messageData?.typeMessage ?? "media";
      const fileName = deriveGreenApiFileName(messageType, mimeType, normalized.media.fileName);
      const storagePath = buildPendingStoragePath(fileName);
      await uploadToStorage(buffer, storagePath, mimeType);

      const captionPart = normalized.media.caption
        ? normalized.media.caption.length > MESSAGE_PREVIEW_LIMIT
          ? normalized.media.caption.slice(0, MESSAGE_PREVIEW_LIMIT) + "…"
          : normalized.media.caption
        : null;
      const rawMessage = [idTag, captionPart].filter(Boolean).join(" ") || idTag;

      const pending = await prisma.pendingDocument.create({
        data: {
          sourceChannel: "WHATSAPP",
          senderInfo,
          fileUrl: storagePath,
          fileName,
          mimeType,
          rawMessage,
          status: "PENDING"
        }
      });
      return NextResponse.json({ ok: true, pendingDocumentId: pending.id });
    }

    // unsupported kind — log a placeholder row so nothing is silently dropped.
    const note = normalized.reason ?? "(הודעה לא נתמכת)";
    const rawMessage = [idTag, note].filter(Boolean).join(" ");
    const pending = await prisma.pendingDocument.create({
      data: {
        sourceChannel: "WHATSAPP",
        senderInfo,
        fileUrl: "",
        fileName: null,
        mimeType: null,
        rawMessage,
        status: "PENDING"
      }
    });
    return NextResponse.json({ ok: true, pendingDocumentId: pending.id, kind: "unsupported" });
  } catch (err) {
    // Log + 500. Green API will retry, which is what we want for transient
    // storage/database errors.
    console.error("[green-api-webhook] processing failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 }
    );
  }
}
