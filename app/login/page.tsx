import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const session = await auth();
  if (session?.user) {
    redirect(callbackUrl || "/");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-brand-navy p-4 text-brand-navy-foreground">
      {/* Soft orange glow accents echoing the marketing hero */}
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
          className="h-auto w-72 object-contain drop-shadow-xl sm:w-80"
        />

        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
            ניהול בירוקרטי
            <br />
            <span className="text-primary">לפרויקטי נדל״ן</span>
          </h1>
          <p className="mt-2 text-sm text-brand-navy-foreground/70">
            התחברו כדי להמשיך לניהול ההיתרים והפרויקטים שלכם.
          </p>
        </div>

        <div className="w-full rounded-xl border border-white/10 bg-card text-card-foreground shadow-2xl">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}
