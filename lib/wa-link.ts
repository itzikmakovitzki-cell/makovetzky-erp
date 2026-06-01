// Build a wa.me deeplink so the user lands in WhatsApp with the message
// pre-filled — they still press Send manually. Critical: this never
// triggers a send on its own. The system has no path to the WhatsApp
// Business API; all messaging stays admin-initiated.
//
// Phone normalisation (single source of truth — both
// WhatsAppReminderButton and the client-profile send dialog use this):
//   - strip every non-digit character (spaces, dashes, parentheses, "+")
//   - if the remaining string starts with "0" (Israeli local), replace it
//     with "972"
//   - if it doesn't start with "972", we still pass whatever's there —
//     wa.me will reject obviously bad numbers in-browser

export function buildWaMeUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const intl = digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
