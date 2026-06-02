"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { resetUserPassword } from "@/app/actions/users";
import { cn } from "@/lib/utils";

// Admin-only password override (spec: an explicit button per row on
// /settings/users next to "ערוך" / "השבת"). The form only needs the new
// password — admin auth is the gate (server action runs requireRole). Self-
// reset is blocked server-side; the row hides the button when isSelf to
// avoid even offering the action.

const PASSWORD_MIN_LENGTH = 8;

export function ResetPasswordDialog({
  userId,
  userName,
  onClose
}: {
  userId: string;
  userName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`הסיסמה חייבת להיות לפחות ${PASSWORD_MIN_LENGTH} תווים`);
      return;
    }
    if (newPassword !== confirm) {
      setError("האישור לא תואם");
      return;
    }
    const proceed = window.confirm(
      `לאפס את הסיסמה של "${userName}"?\n\nהמשתמש יצטרך להשתמש בסיסמה החדשה בהתחברות הבאה. הפעולה תירשם ב-יומן הפעולות.`
    );
    if (!proceed) return;
    startTransition(async () => {
      const r = await resetUserPassword({ userId, newPassword });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk(true);
      router.refresh();
      setTimeout(onClose, 1200);
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
          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <KeyRound className="size-4 text-amber-600" />
            איפוס סיסמה — {userName}
          </h3>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 px-3 py-3">
          <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            איפוס מנהל — לא דורש את הסיסמה הישנה. המשתמש לא יקבל הודעה אוטומטית; אתה אחראי להעביר לו את הסיסמה החדשה בצורה בטוחה.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium">סיסמה חדשה</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={PASSWORD_MIN_LENGTH}
              required
              autoFocus
              className="rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-[10px] text-muted-foreground">
              לפחות {PASSWORD_MIN_LENGTH} תווים.
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium">אישור</span>
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
              הסיסמה אופסה
            </p>
          )}
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 -mx-3 -mb-3 px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={pending || ok}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-1 text-[12px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : ok ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <KeyRound className="size-3" />
              )}
              אפס סיסמה
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
