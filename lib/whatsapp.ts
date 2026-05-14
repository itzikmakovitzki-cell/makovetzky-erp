import crypto from "node:crypto";

// Meta Cloud API helper. All env access is lazy so missing config raises a
// clear error at the webhook entry point rather than at import time.

const GRAPH_VERSION = "v20.0";

export type WhatsAppMediaInfo = {
  url: string;
  mimeType: string;
  fileSize: number;
  fileName: string | null;
};

export function getWhatsAppConfig() {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const displayPhoneNumber = process.env.WHATSAPP_DISPLAY_PHONE_NUMBER ?? null;
  return { verifyToken, accessToken, appSecret, phoneNumberId, displayPhoneNumber };
}

export function isWhatsAppConfigured(): boolean {
  const { verifyToken, accessToken, phoneNumberId } = getWhatsAppConfig();
  return Boolean(verifyToken && accessToken && phoneNumberId);
}

// Timing-safe comparison of the X-Hub-Signature-256 header (`sha256=...`)
// against an HMAC of the raw body computed with WHATSAPP_APP_SECRET. If the
// app secret is not configured we refuse to verify — never accept unsigned
// requests in production.
export function verifyMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const { appSecret } = getWhatsAppConfig();
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
}

// Two-step media fetch:
//  1. GET /{media-id} with bearer token → metadata including a short-lived URL
//  2. GET that URL with the same bearer token → the file bytes
async function fetchMediaMetadata(mediaId: string): Promise<{ url: string; mime_type: string; file_size: number }> {
  const { accessToken } = getWhatsAppConfig();
  if (!accessToken) throw new Error("WHATSAPP_ACCESS_TOKEN not configured");
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta media metadata fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function downloadWhatsAppMedia(mediaId: string, fallbackFileName: string | null): Promise<{ buffer: ArrayBuffer; info: WhatsAppMediaInfo }> {
  const { accessToken } = getWhatsAppConfig();
  if (!accessToken) throw new Error("WHATSAPP_ACCESS_TOKEN not configured");
  const meta = await fetchMediaMetadata(mediaId);
  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!fileRes.ok) {
    throw new Error(`Meta media download failed (${fileRes.status})`);
  }
  const buffer = await fileRes.arrayBuffer();
  return {
    buffer,
    info: {
      url: meta.url,
      mimeType: meta.mime_type,
      fileSize: meta.file_size ?? buffer.byteLength,
      fileName: fallbackFileName
    }
  };
}

// Pick a sensible filename for a media message. WhatsApp documents carry a
// filename; images/audio/video don't, so we synthesize one from the mime type.
export function deriveFileName(messageType: string, mimeType: string, providedName: string | null): string {
  if (providedName && providedName.trim()) return providedName.trim();
  const ext = (mimeType.split("/")[1] || "bin").split(";")[0];
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `whatsapp-${messageType}-${ts}.${ext}`;
}

// Truncate long text bodies so we don't store giant blobs in `rawMessage`.
export function truncate(s: string, max = 4000): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}
