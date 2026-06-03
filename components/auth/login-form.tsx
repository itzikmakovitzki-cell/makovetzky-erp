"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { signInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

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

      <Button
        type="submit"
        variant="cta"
        size="pill"
        disabled={isPending}
        className="w-full"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        התחבר
      </Button>

      <div className="pt-1 text-center">
        <Link
          href="/forgot-password"
          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          שכחת סיסמה?
        </Link>
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
