"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, MessageCircle, Phone, ShieldOff } from "lucide-react";
import type { ClientNotificationPreference } from "@prisma/client";
import {
  recordClientWhatsAppSend,
  setClientNotificationPreference
} from "@/app/actions/clients";
import { buildWaMeUrl } from "@/lib/wa-link";
import { cn } from "@/lib/utils";

// Client-side WhatsApp control panel for a single Client profile.
//
// Two responsibilities:
//   1. Notification preference toggle (OFF / MANUAL_ONLY). OFF hides the
//      send UI entirely — even an accidental click can't reach the client.
//   2. Manual-send dialog (visible only under MANUAL_ONLY). Opens
//      wa.me with a pre-filled message; the admin presses Send inside
//      WhatsApp itself. We never auto-send anything.
//
// Every send opens an audit row via recordClientWhatsAppSend so the
// /settings/audit-log shows a chronological record of who reached out
// when. The audit happens BEFORE we open the WhatsApp tab, so a rejected
// log (e.g. prefs flipped to OFF mid-flow) blocks the open.

export function ClientWhatsAppPanel({
  clientId,
  clientName,
  clientPhone,
  initialPreference
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  initialPreference: ClientNotificationPreference;
}) {
  const [preference, setPreference] = useState<ClientNotificationPreference>(
    initialPreference
  );
  const [savingPref, startPrefSave] = useTransition();
  const [prefError, setPrefError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const togglePreference = (next: ClientNotificationPreference) => {
    if (next === preference) return;
    setPrefError(null);
    // Optimistic — flips immediately, reverts on error.
    setPreference(next);
    startPrefSave(async () => {
      const r = await setClientNotificationPreference({
        clientId,
        preference: next
      });
      if (!r.ok) {
        setPreference(initialPreference);
        setPrefError(r.error);
      }
    });
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="border-b bg-muted/30 px-3 py-1.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MessageCircle className="size-3.5 text-emerald-600" />
          תקשורת — WhatsApp
        </h2>
      </div>
      <div className="space-y-2 px-3 py-2">
        {/* Preference pill */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium">העדפת התראות:</span>
          <div
            role="radiogroup"
            className="inline-flex items-center rounded-md border border-input bg-background p-0.5"
          >
            <PrefPill
              label="🔕 כבוי"
              active={preference === "OFF"}
              onClick={() => togglePreference("OFF")}
              disabled={savingPref}
            />
            <PrefPill
              label="✋ ידני בלבד"
              active={preference === "MANUAL_ONLY"}
              onClick={() => togglePreference("MANUAL_ONLY")}
              disabled={savingPref}
            />
          </div>
          {savingPref && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
        </div>

        {prefError && (
          <p className="inline-flex items-center gap-1 text-[10px] text-red-700">
            <AlertTriangle className="size-3" />
            {prefError}
          </p>
        )}

        {preference === "OFF" ? (
          <div className="inline-flex items-center gap-1.5 rounded border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300">
            <ShieldOff className="size-3" />
            התראות כבויות — כפתור השליחה מוסתר
          </div>
        ) : (
          <>
            <p className="text-[10.5px] text-muted-foreground">
              המערכת לעולם לא שולחת באופן אוטומטי. לחיצה רק פותחת את WhatsApp עם
              הטקסט מוכן — ה<strong>שליחה הסופית</strong> בידיים שלך.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                disabled={!clientPhone}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  clientPhone
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <MessageCircle className="size-3.5" />
                שלח עדכון ב-WhatsApp
              </button>
              {clientPhone ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Phone className="size-3" />
                  {clientPhone}
                </span>
              ) : (
                <span className="text-[10px] text-amber-700">
                  אין טלפון ללקוח — ערוך את הפרופיל כדי להוסיף
                </span>
              )}
            </div>
          </>
        )}
      </div>
      {composeOpen && (
        <ComposeDialog
          clientId={clientId}
          clientName={clientName}
          clientPhone={clientPhone}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}

function PrefPill({
  label,
  active,
  onClick,
  disabled
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        disabled && "opacity-60"
      )}
    >
      {label}
    </button>
  );
}

function ComposeDialog({
  clientId,
  clientName,
  clientPhone,
  onClose
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  onClose: () => void;
}) {
  const [text, setText] = useState(
    `שלום ${clientName.split(" ")[0] ?? ""},\n\n`
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const send = () => {
    setError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("ההודעה ריקה");
      return;
    }
    const waUrl = buildWaMeUrl(clientPhone, trimmed);
    if (!waUrl) {
      setError("טלפון לא תקין");
      return;
    }
    startTransition(async () => {
      const r = await recordClientWhatsAppSend({ clientId, message: trimmed });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.open(waUrl, "_blank", "noopener,noreferrer");
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-md border bg-card shadow-lg">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h3 className="text-sm font-semibold">
            שלח עדכון ל-{clientName}
          </h3>
        </div>
        <div className="space-y-2 px-3 py-3">
          <p className="text-[10.5px] text-muted-foreground">
            ההודעה תיפתח ב-WhatsApp Web/App עם המספר {clientPhone}. עליך ללחוץ
            Send בעצמך — המערכת לא שולחת כלום.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="הקלד את ההודעה ללקוח…"
            className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          {error && (
            <p className="inline-flex items-center gap-1 text-[11px] text-red-700">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <MessageCircle className="size-3" />
            )}
            פתח WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
