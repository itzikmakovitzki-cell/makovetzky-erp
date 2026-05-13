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
    <main className="grid min-h-screen place-items-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt="מקובצקי — ניהול פרויקטים"
          width={160}
          height={160}
          priority
          className="h-auto w-40 object-contain drop-shadow-sm"
        />
        <div className="w-full rounded-md border bg-card shadow-sm">
          <LoginForm callbackUrl={callbackUrl} />
        </div>
      </div>
    </main>
  );
}
