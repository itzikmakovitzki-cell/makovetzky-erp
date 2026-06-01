"use client";

import { useState } from "react";
import { MessageCircle, Check } from "lucide-react";
import { buildWaMeUrl } from "@/lib/wa-link";
import { cn } from "@/lib/utils";

// Block 25 + PR-W: one-click WhatsApp reminder for a task's assignee. Always
// copies a pre-filled Hebrew message to the clipboard; if the assignee's
// User.phone is populated, ALSO opens wa.me with the text — the user still
// presses Send in WhatsApp itself. Until PR-W (migration 014), User.phone
// didn't exist and the wa.me path was dormant.
export function WhatsAppReminderButton({
  assigneeName,
  taskName,
  projectName,
  phone,
  className
}: {
  assigneeName: string | null;
  taskName: string;
  projectName: string;
  phone?: string | null;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!assigneeName) return null;

  const message = `היי ${assigneeName}, תזכורת לגבי משימה: ${taskName} בפרויקט ${projectName}. אפשר סטטוס?`;

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("העתק את התזכורת:", message);
    }
    const waUrl = buildWaMeUrl(phone, message);
    if (waUrl) window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={() => void handle()}
      title={copied ? "התזכורת הועתקה" : `העתק תזכורת ל${assigneeName}`}
      aria-label="תזכורת וואטסאפ לאחראי"
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500/50",
        className
      )}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <MessageCircle className="size-3.5" aria-hidden />
      )}
    </button>
  );
}
