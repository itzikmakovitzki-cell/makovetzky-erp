"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  ShieldOff
} from "lucide-react";
import type { ClientNotificationPreference } from "@prisma/client";
import {
  checkGreenApiConfigured,
  sendClientWhatsAppMessage,
  setClientNotificationPreference
} from "@/app/actions/clients";
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
  // Green-API config status is fetched once on mount so the compose button
  // can label itself "שלח עכשיו" (real send) vs "פתח WhatsApp" (wa.me).
  const [greenApiConfigured, setGreenApiConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void checkGreenApiConfigured().then((r) => {
      if (alive) setGreenApiConfigured(r.configured);
    });
    return () => {
      alive = false;
    };
  }, []);

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
    <div className="overflow-hidden rounded-2xl border border-emerald-200/70 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.055)]">
      <div className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 text-sm font-bold text-brand-navy">
          <MessageCircle className="size-3.5 text-emerald-600" />
          תקשורת — WhatsApp
        </h2>
      </div>
      <div className="space-y-3 px-4 py-4">
        {/* Preference pill */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium">העדפת התראות:</span>
          <div
            role="radiogroup"
            className="inline-flex items-center rounded-xl border border-input bg-background p-1"
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
              {greenApiConfigured
                ? "השליחה מתבצעת דרך Green API ברגע שאתה לוחץ 'שלח'. המערכת לא שולחת מיוזמתה — כל שליחה היא בלחיצה ידנית שלך."
                : "המערכת לעולם לא שולחת באופן אוטומטי. לחיצה רק פותחת את WhatsApp עם הטקסט מוכן — ה‎שליחה הסופית בידיים שלך."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                disabled={!clientPhone}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-colors",
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
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px]",
                greenApiConfigured === true &&
                  "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300",
                greenApiConfigured === false &&
                  "border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
                greenApiConfigured === null && "border-input text-muted-foreground"
              )}
            >
              {greenApiConfigured === true && <CheckCircle2 className="size-3" />}
              {greenApiConfigured === false && <AlertTriangle className="size-3" />}
              {greenApiConfigured === true
                ? "Green API: מוגדר — שליחה ישירה דרך השרת"
                : greenApiConfigured === false
                  ? "Green API: לא מוגדר — שליחה דרך WhatsApp Web (wa.me)"
                  : "בודק תצורת Green API…"}
            </span>
          </>
        )}
      </div>
      {composeOpen && (
        <ComposeDialog
          clientId={clientId}
          clientName={clientName}
          clientPhone={clientPhone}
          greenApiConfigured={greenApiConfigured === true}
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
  greenApiConfigured,
  onClose
}: {
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  greenApiConfigured: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState(
    `שלום ${clientName.split(" ")[0] ?? ""},\n\n`
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentVia, setSentVia] = useState<"green-api" | null>(null);

  const send = () => {
    setError(null);
    setSentVia(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setError("ההודעה ריקה");
      return;
    }
    // Extra checkpoint when sending server-side via Green API — wa.me has
    // its own preview in WhatsApp itself before Send is pressed, but the
    // Green API path is immediate, so confirm() acts as the last gate.
    if (greenApiConfigured) {
      const proceed = window.confirm(
        `לשלוח את ההודעה הזו ל-${clientName}?\n\nההודעה תצא מהמערכת מיד דרך Green API.`
      );
      if (!proceed) return;
    }
    startTransition(async () => {
      const r = await sendClientWhatsAppMessage({ clientId, message: trimmed });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.via === "green-api") {
        // Real send completed server-side. Show success briefly, then close.
        setSentVia("green-api");
        setTimeout(onClose, 1200);
        return;
      }
      // Fallback path: server returned a wa.me URL for the admin to open.
      window.open(r.waUrl, "_blank", "noopener,noreferrer");
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
            {greenApiConfigured
              ? `ההודעה תישלח דרך Green API ל-${clientPhone} ברגע שתאשר.`
              : `ההודעה תיפתח ב-WhatsApp Web/App עם המספר ${clientPhone}. עליך ללחוץ Send בעצמך — המערכת לא שולחת כלום.`}
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
          {sentVia === "green-api" && (
            <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="size-3" />
              ההודעה נשלחה דרך Green API
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
            disabled={pending || sentVia !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : sentVia === "green-api" ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <MessageCircle className="size-3" />
            )}
            {greenApiConfigured ? "📤 שלח עכשיו" : "פתח WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
