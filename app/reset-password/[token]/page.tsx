import Image from "next/image";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const dynamic = "force-dynamic";

// Token-consume page. Validates the token server-side at render time so an
// expired/used/missing token shows a clear error instead of a blank form
// that fails on submit. The token itself never leaves this page in a
// querystring or in a server-action argument the client could trivially
// inspect — it's passed via the URL path and re-read by the action.

export default async function ResetPasswordPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Cheap validity pre-check. We do NOT mark the token used here — that
  // happens only when the user submits a new password successfully.
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: {
      user: { select: { name: true, email: true, isActive: true } }
    }
  });

  const now = Date.now();
  const invalid = !record;
  const used = !!record?.usedAt;
  const expired = !!record && record.expiresAt.getTime() < now;
  const userInactive = !!record && !record.user.isActive;
  const reason = invalid
    ? "הקישור לא חוקי או שנמחק"
    : used
      ? "הקישור כבר שומש פעם אחת. בקש קישור חדש."
      : expired
        ? "הקישור פג תוקף. בקש קישור חדש."
        : userInactive
          ? "החשבון לא פעיל. פנה למנהל מערכת."
          : null;

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
        <div className="flex items-center justify-center rounded-xl bg-white/95 px-5 py-4 shadow-lg">
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={640}
            height={271}
            priority
            className="h-auto w-60 object-contain"
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            קביעת סיסמה חדשה
          </h1>
          {record && !reason && (
            <p className="mt-2 text-sm text-white/70">
              חשבון: <span className="font-medium">{record.user.name}</span> ·{" "}
              {record.user.email}
            </p>
          )}
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-card text-card-foreground shadow-2xl">
          {reason ? (
            <div className="p-5 text-center">
              <div className="mb-2 inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="size-4" />
                <span className="font-semibold">לא ניתן להמשיך</span>
              </div>
              <p className="text-[12px] text-muted-foreground">{reason}</p>
              <Link
                href="/forgot-password"
                className="mt-3 inline-block text-[11px] text-primary underline-offset-2 hover:underline"
              >
                בקש קישור איפוס חדש
              </Link>
            </div>
          ) : (
            <ResetPasswordForm token={token} />
          )}
        </div>

        <Link
          href="/login"
          className="text-[12px] text-white/70 underline-offset-2 hover:text-white hover:underline"
        >
          חזרה להתחברות
        </Link>
      </div>
    </main>
  );
}
