// Spec: docs/spec-whatsapp-groups.md §4.1–4.2 (PR-3).
//
// Decides whether an inbound group message is "for the system" — and if so,
// extracts the trailing free text as the suggested task name. Pure functions,
// no fetch / no DB — easy to unit-test and safe to call from the webhook hot
// path.
//
// Trigger logic (MVP): a message qualifies when its body contains an @mention
// of the system's WhatsApp number OR display name. quotedMessage replies are
// also a spec trigger, but matching them precisely needs outbound-idMessage
// bookkeeping that PR #53 doesn't keep — deferred to a follow-up.
//
// The two recognized tokens come from env vars (set on Vercel once the
// dedicated system phone is provisioned — checklist item 10.2 of the spec):
//   SYSTEM_WHATSAPP_PHONE  — international digits only, e.g. "972501234567"
//                            (matches "@972…" or "@+972…" in the text).
//   SYSTEM_WHATSAPP_NAME   — Hebrew display name, e.g. "מקובצקי"
//                            (matches "@מקובצקי" in the text).
// When neither is set, the parser reports no mention — no orphan/permit
// auto-fill happens and the inbound flow stays in legacy mode.

const PHONE_DIGIT_RE = /\D/g;

/** Strip non-digits from a possibly-formatted phone ("+972-50-..." → "97250..."). */
export function normalizePhoneDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(PHONE_DIGIT_RE, "");
}

export type SystemMentionTokens = {
  /** International-format digits, no '+'. Empty string = ignore. */
  phone: string;
  /** Hebrew/free-text display name. Empty string = ignore. */
  name: string;
};

/** Read tokens from env so callers don't have to deal with process.env directly. */
export function readSystemMentionTokens(): SystemMentionTokens {
  return {
    phone: normalizePhoneDigits(process.env.SYSTEM_WHATSAPP_PHONE),
    name: (process.env.SYSTEM_WHATSAPP_NAME ?? "").trim()
  };
}

export type MentionParseResult = {
  /** True iff at least one recognized @mention of the system was found. */
  mentioned: boolean;
  /** Text after stripping the mention token, trimmed. Null if empty. */
  suggestedTaskName: string | null;
};

/**
 * Walk every recognized mention pattern, return on the first hit. Order
 * matters: phone first (less ambiguous), then name (which could be a Hebrew
 * substring that happens to appear in unrelated text).
 *
 * Examples (spec §4.2):
 *   "@מקובצקי טופס 4 חתום"               → mentioned, "טופס 4 חתום"
 *   "@מקובצקי"                            → mentioned, null
 *   "@מקובצקי אישור גינון - מהנדס יואב"  → mentioned, "אישור גינון - מהנדס יואב"
 *   "@972501234567 איך אתה?"             → mentioned, "איך אתה?"
 *   "שלום לכולם"                          → not mentioned
 */
export function parseSystemMention(
  text: string | null | undefined,
  tokens: SystemMentionTokens
): MentionParseResult {
  const body = (text ?? "").trim();
  if (!body) return { mentioned: false, suggestedTaskName: null };

  const patterns: RegExp[] = [];
  if (tokens.phone) {
    // Accept "@972…" or "@+972…". Escape just in case digits ever contain
    // regex meta (they won't, but defensive).
    const escaped = tokens.phone.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`@\\+?${escaped}\\b`, "g"));
  }
  if (tokens.name) {
    // Hebrew has no word boundary in JS regex (\b is ASCII-only) — anchor on
    // either a non-letter or end-of-string instead.
    const escaped = tokens.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns.push(new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, "gu"));
  }

  let mentioned = false;
  let stripped = body;
  for (const p of patterns) {
    if (p.test(stripped)) {
      mentioned = true;
      // Reset lastIndex because we re-use the same RegExp.
      p.lastIndex = 0;
      stripped = stripped.replace(p, " ");
    }
  }
  if (!mentioned) return { mentioned: false, suggestedTaskName: null };

  const remainder = stripped.replace(/\s+/g, " ").trim();
  return {
    mentioned: true,
    suggestedTaskName: remainder.length > 0 ? remainder : null
  };
}

/** Helper for tests + the webhook: is a chatId a group? */
export function isGroupChatId(chatId: string | null | undefined): boolean {
  return !!chatId && chatId.endsWith("@g.us");
}
