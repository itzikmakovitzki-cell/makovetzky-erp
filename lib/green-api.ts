// Green API (green-api.com) — two halves:
//
//   (1) inbound: webhook payload types + a small normalizer. Used by the
//       Block 8c WhatsApp webhook receiver to ingest incoming messages.
//   (2) outbound: sendWhatsAppMessage() + isGreenApiConfigured() at the
//       bottom of this file (PR-G). Drives the admin-initiated client send
//       flow. NEVER triggered by a scheduler — every call traces back to
//       an admin clicking a button.
//
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

// Green API includes a quotedMessage block when the inbound message is a
// reply. Shape varies a bit between message types — `participant` is the
// chatId of whoever sent the message being quoted ("972…@c.us" for a person
// in a group). We only need participant + stableId for spec §4.1's
// reply-to-system trigger; the rest of the quoted body is ignored.
export type GreenApiQuotedMessage = {
  stanzaId?: string;
  participant?: string;
  typeMessage?: string;
  textMessage?: string;
};

export type GreenApiMessageData = {
  typeMessage?: string;
  textMessageData?: { textMessage?: string };
  extendedTextMessageData?: {
    text?: string;
    // Present when the user replied to a previous message in the chat.
    // Same shape Green API documents under "Quoted message".
    quotedMessage?: GreenApiQuotedMessage;
  };
  fileMessageData?: GreenApiFileMessageData & {
    // Captions on media replies still carry the quotedMessage block.
    quotedMessage?: GreenApiQuotedMessage;
  };
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
  fromPhone: string; // E.164-ish, no '+'. For groups: the SENDER's phone (not the group).
  senderName: string | null; // For groups: the group MEMBER name (not the group display name).
  // Raw chatId from Green API — "972…@c.us" for private chats,
  // "972…-1638…@g.us" for groups. Used by the webhook to branch on
  // isGroupChatId() and to upsert ProjectWhatsAppGroup rows (spec PR-3).
  chatId: string | null;
  // Group display name (chatName from the webhook). Null when not a group
  // or when WhatsApp didn't supply it. Cached on ProjectWhatsAppGroup.groupName.
  chatName: string | null;
  // When the message is a reply, this is the participant chatId of whoever
  // sent the message being quoted (e.g. "972539456995@c.us" if the user
  // replied to the system). Null when not a reply. Drives spec §4.1's
  // reply-to-system trigger — the webhook compares this to the system's
  // own chatId and treats a match as a mention.
  quotedParticipant: string | null;
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
  // For private chats Green API omits sender.sender and chatName is the
  // contact's name — so the existing fallback (senderName → chatName) still
  // works. For groups, senderName = member display, chatName = group display
  // — keep them separate so the webhook can populate both ProjectWhatsAppGroup
  // .groupName and PendingDocument.authorName correctly.
  const isGroup = !!sender.chatId && sender.chatId.endsWith("@g.us");
  const senderName = isGroup
    ? ((sender.senderName ?? "").trim() || null)
    : ((sender.senderName ?? "").trim() || (sender.chatName ?? "").trim() || null);
  const chatName = isGroup ? ((sender.chatName ?? "").trim() || null) : null;
  const chatId = (sender.chatId ?? "").trim() || null;

  const msg = payload.messageData ?? {};
  const type = msg.typeMessage;
  // Reply detection: both extendedTextMessage and the media variants can carry
  // a quotedMessage. Plain textMessage never does.
  const quotedParticipant =
    (msg.extendedTextMessageData?.quotedMessage?.participant ?? "").trim() ||
    (msg.fileMessageData?.quotedMessage?.participant ?? "").trim() ||
    null;

  if (type === "textMessage") {
    const text = (msg.textMessageData?.textMessage ?? "").trim();
    return {
      kind: "text",
      idMessage,
      fromPhone,
      senderName,
      chatId,
      chatName,
      quotedParticipant,
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
      chatId,
      chatName,
      quotedParticipant,
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
        chatId,
        chatName,
        quotedParticipant,
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
      chatId,
      chatName,
      quotedParticipant,
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
    chatId,
    chatName,
    quotedParticipant,
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

// =============================================================
// Outbound send (PR-G).
// =============================================================
//
// Required env vars on Vercel:
//   GREEN_API_ID_INSTANCE     — instance id from the Green API console
//   GREEN_API_TOKEN_INSTANCE  — API token for that instance
//
// When either is missing, isGreenApiConfigured() returns false and the
// caller is expected to fall back to a wa.me deeplink (the PR #52
// behaviour). This is by design: a fresh deploy without credentials
// should still be usable, just without server-side sends.

const SEND_URL_TEMPLATE =
  "https://api.green-api.com/waInstance{idInstance}/sendMessage/{apiTokenInstance}";

// sendFileByUrl: Green API pulls a file from a publicly-fetchable URL and
// posts it as a WhatsApp media message. The URL doesn't need to be public
// in the search-engine sense — a Supabase signed URL works because it's
// just an HTTPS GET that anyone with the link can resolve.
const SEND_FILE_URL_TEMPLATE =
  "https://api.green-api.com/waInstance{idInstance}/sendFileByUrl/{apiTokenInstance}";

export function isGreenApiConfigured(): boolean {
  return (
    !!process.env.GREEN_API_ID_INSTANCE &&
    !!process.env.GREEN_API_TOKEN_INSTANCE
  );
}

// Normalize a phone string to the chatId format Green API expects.
//   "+972-50-1234567" → "972501234567@c.us"
//   "0501234567"      → "972501234567@c.us"
export function phoneToChatId(phone: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `${intl}@c.us`;
}

export type GreenApiSendResult =
  | { ok: true; idMessage: string }
  | { ok: false; error: string };

export async function sendWhatsAppMessage(args: {
  phone: string;
  message: string;
}): Promise<GreenApiSendResult> {
  const idInstance = process.env.GREEN_API_ID_INSTANCE;
  const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!idInstance || !apiTokenInstance) {
    return { ok: false, error: "Green API לא מוגדר במערכת" };
  }
  const chatId = phoneToChatId(args.phone);
  if (!chatId) {
    return { ok: false, error: "מספר טלפון לא תקין" };
  }

  const url = SEND_URL_TEMPLATE
    .replace("{idInstance}", idInstance)
    .replace("{apiTokenInstance}", apiTokenInstance);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, message: args.message }),
      // 15s upper bound — Green API normally responds in well under 2s.
      // Without this a hanging connection would freeze the server action.
      signal: AbortSignal.timeout(15_000)
    });
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        // ignore — error already surfaces via status
      }
      return {
        ok: false,
        error: `Green API החזיר ${res.status}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`
      };
    }
    const body = (await res.json()) as { idMessage?: string };
    if (!body.idMessage) {
      return { ok: false, error: "Green API החזיר תגובה ללא idMessage" };
    }
    return { ok: true, idMessage: body.idMessage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `שגיאת רשת מול Green API: ${msg}` };
  }
}

// Sends a media file (image / pdf / doc / etc.) via Green API. Accepts a URL
// Green API can fetch — typically a Supabase signed URL from our private
// bucket. Optional caption is rendered as the WhatsApp message text under
// the media. The chatId can be a `*@c.us` (1-on-1) or `*@g.us` (group).
export async function sendWhatsAppFile(args: {
  chatId?: string;
  phone?: string;
  fileUrl: string;
  fileName: string;
  caption?: string;
}): Promise<GreenApiSendResult> {
  const idInstance = process.env.GREEN_API_ID_INSTANCE;
  const apiTokenInstance = process.env.GREEN_API_TOKEN_INSTANCE;
  if (!idInstance || !apiTokenInstance) {
    return { ok: false, error: "Green API לא מוגדר במערכת" };
  }
  const chatId = args.chatId ?? (args.phone ? phoneToChatId(args.phone) : null);
  if (!chatId) {
    return { ok: false, error: "chatId / מספר טלפון לא תקין" };
  }
  if (!args.fileUrl) {
    return { ok: false, error: "fileUrl חסר" };
  }

  const url = SEND_FILE_URL_TEMPLATE
    .replace("{idInstance}", idInstance)
    .replace("{apiTokenInstance}", apiTokenInstance);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        urlFile: args.fileUrl,
        fileName: args.fileName,
        caption: args.caption ?? undefined
      }),
      // Green API needs to download the file from urlFile before responding,
      // so the upper bound here is more generous than the text-send timeout.
      signal: AbortSignal.timeout(45_000)
    });
    if (!res.ok) {
      let bodyText = "";
      try {
        bodyText = await res.text();
      } catch {
        // ignore — error already surfaces via status
      }
      return {
        ok: false,
        error: `Green API החזיר ${res.status}${bodyText ? ` — ${bodyText.slice(0, 200)}` : ""}`
      };
    }
    const body = (await res.json()) as { idMessage?: string };
    if (!body.idMessage) {
      return { ok: false, error: "Green API החזיר תגובה ללא idMessage" };
    }
    return { ok: true, idMessage: body.idMessage };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `שגיאת רשת מול Green API: ${msg}` };
  }
}
