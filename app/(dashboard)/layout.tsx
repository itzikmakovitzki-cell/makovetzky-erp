import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/global/dashboard-nav";
import { MobileBottomNav } from "@/components/global/mobile-bottom-nav";
import { UserMenu } from "@/components/global/user-menu";
import { CommandPalette } from "@/components/global/command-palette";
import {
  CommandPaletteTrigger,
  CommandPaletteIconButton
} from "@/components/global/command-palette-trigger";
import { Scratchpad } from "@/components/global/scratchpad";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware enforces auth, but we still read the session here to display the user.
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-l border-white/10 bg-brand-navy px-3 py-4 text-brand-navy-foreground md:flex md:sticky md:top-0 md:h-screen">
        <Link
          href="/"
          aria-label="מקובצקי — לדף הבית"
          className="mb-4 flex items-center justify-center rounded-md bg-white/95 px-2 py-3 transition-shadow hover:shadow-md"
        >
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={480}
            height={203}
            priority
            className="h-auto w-full max-w-[180px] object-contain"
          />
        </Link>
        <CommandPaletteTrigger className="mb-3" />
        <DashboardNav role={user?.role} />
        {user && (
          <UserMenu
            name={user.name ?? "—"}
            email={user.email ?? "—"}
            role={user.role}
          />
        )}
      </aside>
      <div className="flex flex-1 flex-col">
        {/* Mobile-only top bar: brand logo on navy, links home. Desktop uses the sidebar logo. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-center border-b border-white/10 bg-brand-navy px-4 md:hidden">
          <CommandPaletteIconButton className="absolute start-2 top-1/2 -translate-y-1/2" />
          <Link
            href="/"
            aria-label="מקובצקי — לדף הבית"
            className="flex items-center rounded-md bg-white/95 px-3 py-1.5"
          >
            <Image
              src="/logo.png"
              alt="מקובצקי — ניהול פרויקטים"
              width={480}
              height={203}
              priority
              className="h-7 w-auto object-contain"
            />
          </Link>
        </header>
        <main className="flex-1 overflow-auto px-4 py-4 pb-24 md:px-6 md:py-5 md:pb-5">
          {children}
        </main>
      </div>
      <MobileBottomNav
        role={user?.role}
        user={user ? { name: user.name, email: user.email } : null}
      />
      <CommandPalette />
      <Scratchpad />
    </div>
  );
}
