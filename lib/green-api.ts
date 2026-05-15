// Green API (green-api.com) webhook payload types + a small normalizer.
// Reference: https://green-api.com/en/docs/api/receiving/notifications-format/

export type GreenApiSenderData = {
  chatId?: string;
  sender?: string;
  chatName?: string;
  senderName?: string;
};

export type GreenApiInstanceData = {
  idInstance?: number;
  wid?: string;
  typeInstance?: string;
};

export type GreenApiFileMessageData = {
  downloadUrl?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
};

export type GreenApiMessageData = {
  typeMessage?: string;
  textMessageData?: { textMessage?: string };
  extendedTextMessageData?: { text?: string };
  fileMessageData?: GreenApiFileMessageData;
};

export type GreenApiWebhook = {
  typeWebhook?: string;
  instanceData?: GreenApiInstanceData;
  timestamp?: number;
  idMessage?: string;
  senderData?: GreenApiSenderData;
  messageData?: GreenApiMessageData;
};

export type NormalizedIncoming = {
  kind: "text" | "media" | "unsupported";
  idMessage: string | null;
  fromPhone: string; // E.164-ish, no '+'
  senderName: string | null;
  text: string | null;
  media: { downloadUrl: string; fileName: string | null; mimeType: string | null; caption: string | null } | null;
  reason?: string; // for unsupported
};

// Green API encodes WhatsApp IDs as "972501234567@c.us" for individual chats
// and "972501234567-1606912345@g.us" for groups. Strip the suffix and group
// timestamp so we end up with a plain phone number for display.
function phoneFromWid(wid: string | undefined | null): string {
  if (!wid) return "";
  const [head] = wid.split("@");
  return (head ?? "").split("-")[0] ?? "";
}

export function normalizeGreenApiPayload(payload: GreenApiWebhook): NormalizedIncoming | null {
  // We only care about user-sent inbound messages. Skip system/status events.
  if (payload.typeWebhook !== "incomingMessageReceived") return null;

  const sender = payload.senderData ?? {};
  const fromPhone = phoneFromWid(sender.sender || sender.chatId);
  const idMessage = (payload.idMessage ?? "").trim() || null;
  const senderName = (sender.senderName ?? "").trim() || (sender.chatName ?? "").trim() || null;

  const msg = payload.messageData ?? {};
  const type = msg.typeMessage;

  if (type === "textMessage") {
    const text = (msg.textMessageData?.textMessage ?? "").trim();
    return {
      kind: "text",
      idMessage,
      fromPhone,
      senderName,
      text: text || null,
      media: null
    };
  }
  if (type === "extendedTextMessage") {
    const text = (msg.extendedTextMessageData?.text ?? "").trim();
    return {
      kind: "text",
      idMessage,
      fromPhone,
      senderName,
      text: text || null,
      media: null
    };
  }

  // Media variants — they all share the same fileMessageData shape.
  const MEDIA_TYPES = new Set([
    "imageMessage",
    "documentMessage",
    "videoMessage",
    "audioMessage",
    "voiceMessage",
    "stickerMessage"
  ]);
  if (type && MEDIA_TYPES.has(type)) {
    const f = msg.fileMessageData ?? {};
    if (!f.downloadUrl) {
      return {
        kind: "unsupported",
        idMessage,
        fromPhone,
        senderName,
        text: null,
        media: null,
        reason: `${type} ללא downloadUrl`
      };
    }
    return {
      kind: "media",
      idMessage,
      fromPhone,
      senderName,
      text: null,
      media: {
        downloadUrl: f.downloadUrl,
        fileName: (f.fileName ?? "").trim() || null,
        mimeType: (f.mimeType ?? "").trim() || null,
        caption: (f.caption ?? "").trim() || null
      }
    };
  }

  // Anything else (locations, contacts, polls, reactions, …) — record so we
  // do not lose visibility, but mark it as unsupported.
  return {
    kind: "unsupported",
    idMessage,
    fromPhone,
    senderName,
    text: null,
    media: null,
    reason: `סוג הודעה לא נתמך: ${type ?? "unknown"}`
  };
}

export async function downloadGreenApiMedia(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string | null }> {
  // Green API's downloadUrl is pre-signed and public for a short window — no
  // auth header required. We still set a UA for traceability.
  const res = await fetch(url, { headers: { "User-Agent": "makovetzky-erp/1.0 (+green-api)" } });
  if (!res.ok) {
    throw new Error(`Green API media download failed (${res.status})`);
  }
  return {
    buffer: await res.arrayBuffer(),
    mimeType: res.headers.get("content-type")
  };
}

export function deriveGreenApiFileName(typeMessage: string, mimeType: string | null, provided: string | null): string {
  if (provided && provided.trim()) return provided.trim();
  const ext = (mimeType ?? "application/octet-stream").split("/")[1]?.split(";")[0] || "bin";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `green-${typeMessage}-${ts}.${ext}`;
}
