import Image from "next/image";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const dynamic = "force-dynamic";

// Self-service "forgot password" entry point. Symmetrical visually to
// /login so the user doesn't feel ejected from the brand. Submission goes
// to the requestPasswordReset server action which silently no-ops on
// unknown emails (account enumeration protection).

export default function ForgotPasswordPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-brand-navy p-4 text-brand-navy-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -start-24 size-72 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -end-20 size-80 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <Image
          src="/logo-dark.png"
          alt="מקובצקי — ניהול פרויקטים · הביורוקרטיה — עלינו"
          width={600}
          height={600}
          priority
          className="h-auto w-64 object-contain drop-shadow-xl sm:w-72"
        />

        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            שכחת סיסמה?
          </h1>
          <p className="mt-2 text-sm text-brand-navy-foreground/70">
            נשלח אליך קישור איפוס ב-WhatsApp למספר שמירשם בחשבונך.
          </p>
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-card text-card-foreground shadow-2xl">
          <ForgotPasswordForm />
        </div>

        <Link
          href="/login"
          className="text-[12px] text-brand-navy-foreground/70 underline-offset-2 hover:text-brand-navy-foreground hover:underline"
        >
          חזרה להתחברות
        </Link>
      </div>
    </main>
  );
}
