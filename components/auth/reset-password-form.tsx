"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { consumePasswordReset } from "@/app/actions/password-reset";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Two-field form: new password + confirm. The token is supplied by the
// page (URL path) and passed through as a prop — never user-editable.
// On success we redirect to /login with a flag so the user sees a
// "התחבר עם הסיסמה החדשה" toast.

const PASSWORD_MIN_LENGTH = 8;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`הסיסמה חייבת להיות לפחות ${PASSWORD_MIN_LENGTH} תווים`);
      return;
    }
    if (newPassword !== confirm) {
      setError("האישור לא תואם לסיסמה");
      return;
    }
    startTransition(async () => {
      const r = await consumePasswordReset({ token, newPassword });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk(true);
      // Brief pause so the success state is visible, then send them to login.
      setTimeout(() => {
        router.push("/login");
      }, 1200);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 p-5">
      <header className="mb-3 text-center">
        <p className="text-[11px] text-muted-foreground">קביעת סיסמה חדשה</p>
      </header>

      <label className="block">
        <span className="mb-0.5 block text-[11px] font-medium">
          סיסמה חדשה
        </span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          disabled={pending || ok}
          autoFocus
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
        />
        <span className="text-[10px] text-muted-foreground">
          לפחות {PASSWORD_MIN_LENGTH} תווים.
        </span>
      </label>

      <label className="block">
        <span className="mb-0.5 block text-[11px] font-medium">אישור</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          disabled={pending || ok}
          className={cn(
            "w-full rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60",
            confirm && confirm !== newPassword && "border-red-400"
          )}
        />
      </label>

      {error && (
        <div className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
          <AlertTriangle className="size-3" />
          {error}
        </div>
      )}
      {ok && (
        <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3" />
          הסיסמה עודכנה. מעביר אותך להתחברות…
        </div>
      )}

      <Button
        type="submit"
        variant="cta"
        size="pill"
        disabled={pending || ok}
        className="w-full"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <KeyRound className="size-4" />
        )}
        קבע סיסמה חדשה
      </Button>
    </form>
  );
}
