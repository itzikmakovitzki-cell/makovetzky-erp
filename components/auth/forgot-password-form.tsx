"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/password-reset";
import { Button } from "@/components/ui/button";

// Single-field form: email. Server action is intentionally vague about
// whether the email matched a real user (account enumeration protection).
// On success we lock the form to discourage repeated submits, since each
// retry invalidates the previous still-valid token.

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!email.trim()) {
      setError("יש להזין כתובת אימייל");
      return;
    }
    startTransition(async () => {
      const r = await requestPasswordReset(email);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessage(r.message);
    });
  };

  const submitted = !!message;

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-5">
      <header className="mb-3 text-center">
        <p className="text-[11px] text-muted-foreground">איפוס סיסמה</p>
      </header>

      <label className="block">
        <span className="mb-0.5 block text-[11px] font-medium text-foreground">
          אימייל
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={submitted || pending}
          autoComplete="email"
          autoFocus
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
      </label>

      {error && (
        <div className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
          <AlertTriangle className="size-3" />
          {error}
        </div>
      )}

      {message && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-800 dark:text-emerald-300">
          <div className="inline-flex items-center gap-1 font-semibold">
            <CheckCircle2 className="size-3" />
            נשלח בהצלחה
          </div>
          <p className="mt-1 leading-snug">{message}</p>
          <p className="mt-1 text-[10px] opacity-80">
            הקישור תקף לשעה. אם לא הגיע — וודא שמספר ה-WhatsApp שמירשם
            בחשבונך תקין, או פנה למנהל מערכת אחר.
          </p>
        </div>
      )}

      <Button
        type="submit"
        variant="cta"
        size="pill"
        disabled={pending || submitted}
        className="w-full"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        שלח לי קישור איפוס
      </Button>
    </form>
  );
}
