"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { changeOwnPassword } from "@/app/actions/users";
import { cn } from "@/lib/utils";

// Three-field form: current / new / confirm. All validation server-side via
// changeOwnPassword (length + match). The client only catches the trivial
// "confirm doesn't match" check so we save a round-trip.

const PASSWORD_MIN_LENGTH = 8;

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!currentPassword) {
      setError("הסיסמה הנוכחית חובה");
      return;
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`הסיסמה החדשה חייבת להיות לפחות ${PASSWORD_MIN_LENGTH} תווים`);
      return;
    }
    if (newPassword !== confirm) {
      setError("האישור לא תואם לסיסמה החדשה");
      return;
    }
    startTransition(async () => {
      const r = await changeOwnPassword({ currentPassword, newPassword });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk(true);
      setCurrent("");
      setNewPassword("");
      setConfirm("");
      // Refresh server data so the AuditLog row written by the action shows
      // up if /settings/audit-log is open in another tab.
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">סיסמה נוכחית</span>
        <input
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">סיסמה חדשה</span>
        <input
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          required
          className="rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-[10px] text-muted-foreground">
          לפחות {PASSWORD_MIN_LENGTH} תווים.
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium">אישור סיסמה חדשה</span>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={cn(
            "rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring",
            confirm && confirm !== newPassword && "border-red-400"
          )}
        />
      </label>

      {error && (
        <p className="inline-flex items-center gap-1 text-[11px] text-red-700">
          <AlertTriangle className="size-3" />
          {error}
        </p>
      )}
      {ok && (
        <p className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
          <CheckCircle2 className="size-3" />
          הסיסמה עודכנה בהצלחה
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-foreground px-4 py-1.5 text-[12px] font-semibold text-background hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <KeyRound className="size-3.5" />
        )}
        עדכן סיסמה
      </button>
    </form>
  );
}
