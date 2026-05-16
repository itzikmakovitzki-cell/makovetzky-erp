import Image from "next/image";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          <Link href="/portal" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="מקובצקי — ניהול פרויקטים"
              width={480}
              height={203}
              priority
              className="h-auto w-[120px] object-contain sm:w-[140px]"
            />
            <span className="hidden text-[11px] text-muted-foreground sm:inline">פורטל לקוח / קבלן</span>
          </Link>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <span className="hidden items-center gap-1 rounded border border-dashed border-input bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                <ShieldCheck className="size-3" />
                צפייה כאדמין
              </span>
            )}
            <div className="hidden text-end text-[11px] leading-tight sm:block">
              <div className="font-medium text-foreground">{user?.name ?? "—"}</div>
              <div className="text-muted-foreground">{user?.email ?? "—"}</div>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1 text-[12px] hover:bg-accent"
              >
                <LogOut className="size-3" />
                התנתק
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>

      <footer className="border-t bg-card/50">
        <div className="mx-auto w-full max-w-5xl px-3 py-2 text-center text-[10px] text-muted-foreground sm:px-4">
          מקובצקי ניהול פרויקטים · גישה אישית — אנא אל תשתף את הקישור
        </div>
      </footer>
    </div>
  );
}
