"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { signInAction } from "@/app/actions/auth";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, isPending] = useActionState(signInAction, { error: null });

  return (
    <form action={formAction} className="space-y-3 p-5">
      <header className="mb-3 text-center">
        <p className="text-[11px] text-muted-foreground">התחברות לחשבון</p>
      </header>

      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

      <Field label="אימייל">
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      <Field label="סיסמה">
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>

      {state.error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1.5 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : <LogIn className="size-3" />}
        התחבר
      </button>

      <div className="mt-2 rounded border border-dashed border-input bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
        <div className="font-medium text-foreground">חשבונות דמו (סיסמה לכולם: admin123)</div>
        <div className="mt-1 space-y-0.5 tabular-nums">
          <div>אדמין: <code className="font-mono">ofir@makovetzky.local</code></div>
          <div>עובד: <code className="font-mono">yossi@makovetzky.local</code> / <code className="font-mono">dana@makovetzky.local</code></div>
          <div>קבלן: <code className="font-mono">contact@cohenbrothers.local</code></div>
        </div>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}
