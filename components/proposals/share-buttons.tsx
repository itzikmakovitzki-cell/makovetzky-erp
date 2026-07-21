"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";
import { markProposalSent } from "@/app/actions/proposals";

// Builds a phone string suitable for wa.me. Strips leading 0 and adds +972
// (Israel) when it looks like a 9-10 digit local number. Falls back to a
// best-effort digit-only string otherwise.
function buildWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return "972" + digits.slice(1);
  return digits;
}

export function ShareButtons({
  proposalId,
  proposalStatus,
  customerName,
  customerPhone,
  customerEmail
}: {
  proposalId: string;
  proposalStatus: "DRAFT" | "SENT" | "SIGNED" | "REJECTED";
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  // Build the absolute quote URL on the client — keeps the server free of
  // request-URL parsing and works behind any reverse proxy.
  const buildUrl = () =>
    typeof window === "undefined"
      ? `/quote/${proposalId}`
      : `${window.location.origin}/quote/${proposalId}`;

  // Marks DRAFT → SENT on first share. We don't await this in the link
  // openers to keep them snappy and avoid blocking on slow DB round-trips.
  const ensureSent = () => {
    if (proposalStatus !== "DRAFT") return;
    startTransition(async () => {
      await markProposalSent(proposalId);
    });
  };

  const handleCopy = async () => {
    const url = buildUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      ensureSent();
    } catch {
      window.prompt("העתק את הקישור:", url);
    }
  };

  const handleWhatsApp = () => {
    const url = buildUrl();
    const text = `שלום ${customerName}, מצורף קישור להצעת המחיר:\n${url}`;
    const number = buildWhatsAppNumber(customerPhone);
    const waUrl = `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    ensureSent();
  };

  const handleEmail = () => {
    if (!customerEmail) {
      window.alert("לא הוזן אימייל ללקוח");
      return;
    }
    const url = buildUrl();
    const subject = `הצעת מחיר עבור ${customerName}`;
    const body = `שלום ${customerName},\n\nמצורף קישור להצעת המחיר עבורך:\n${url}\n\nבברכה,\nמקובצקי ניהול פרוייקטים`;
    window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    ensureSent();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={pending}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-50"
      >
        {copied ? (
          <Check className="size-3 text-emerald-600" />
        ) : (
          <Copy className="size-3" />
        )}
        {copied ? "הועתק!" : "העתק קישור"}
      </button>
      <button
        type="button"
        onClick={handleWhatsApp}
        disabled={pending}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-emerald-600/50 bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
      >
        <MessageCircle className="size-3" />
        שלח ב-WhatsApp
      </button>
      <button
        type="button"
        onClick={handleEmail}
        disabled={pending || !customerEmail}
        title={customerEmail ? "" : "לא הוזן אימייל ללקוח"}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-background px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-50"
      >
        <Mail className="size-3" />
        שלח באימייל
      </button>
    </div>
  );
}
