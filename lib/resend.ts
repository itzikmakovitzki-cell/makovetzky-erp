// Resend (resend.com) — transactional email transport.
//
// Mirrors the shape of [lib/green-api.ts](lib/green-api.ts) on purpose:
//   * isResendConfigured() lets callers short-circuit when the env isn't set
//     (current state — Resend account / domain / API key haven't been
//     provisioned yet; PR-B ships the call-site, the integration goes live
//     the moment the env vars land on Vercel).
//   * sendEmail() returns a discriminated result so callers can audit which
//     channels actually fired without throwing.
//
// No npm dependency on `resend` — a single POST to api.resend.com/emails is
// enough and keeps node_modules / cold-start light, same trick green-api.ts
// uses for its Send endpoint.

const RESEND_API_URL = "https://api.resend.com/emails";

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(args: {
  to: string;
  subject: string;
  // Both bodies — Resend will pick HTML if the client supports it and fall
  // back to text. We always send both so accessibility / plaintext mail
  // clients (notifications going to engineering firm inboxes) render right.
  html: string;
  text: string;
  // Optional Reply-To so the supplier hits the PM directly, not the no-reply.
  replyTo?: string;
}): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "Resend לא מוגדר במערכת" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
        text: args.text,
        reply_to: args.replyTo
      }),
      // 15s upper bound mirrors green-api — Resend normally returns in <1s,
      // but a hung connection would freeze the calling server action.
      signal: AbortSignal.timeout(15_000)
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Resend החזיר ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`
      };
    }
    const json = (await res.json()) as { id?: string };
    if (!json.id) return { ok: false, error: "תשובת Resend חסרת מזהה" };
    return { ok: true, id: json.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא ידועה בשליחת מייל"
    };
  }
}
