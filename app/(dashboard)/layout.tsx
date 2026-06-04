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
        {/* Horizontal logo art is light-bg; mount it on a brand-cream chip so
            it stays brand-correct against the dark navy sidebar (same pattern
            as the mobile top bar). */}
        <Link
          href="/"
          aria-label="מקובצקי — לדף הבית"
          className="mb-4 flex shrink-0 items-center justify-center rounded-md border-2 border-primary bg-brand-cream px-3 py-2 shadow-sm transition-opacity hover:opacity-95"
        >
          <Image
            src="/logo-horizontal.png"
            alt="מקובצקי — ניהול פרויקטים · הביורוקרטיה — עלינו"
            width={600}
            height={300}
            priority
            className="h-auto w-full object-contain"
          />
        </Link>
        <CommandPaletteTrigger className="mb-3 shrink-0" />
        {/* min-h-0 + overflow-y-auto = the nav scrolls inside the sidebar on
            short viewports (e.g. Bat-Or's small monitor) instead of pushing
            the user menu off-screen. Pinned items stay shrink-0 above/below. */}
        <div className="-mx-1 flex-1 overflow-y-auto px-1 [scrollbar-width:thin]">
          <DashboardNav role={user?.role} />
        </div>
        {user && (
          <div className="shrink-0">
            <UserMenu
              name={user.name ?? "—"}
              email={user.email ?? "—"}
              role={user.role}
            />
          </div>
        )}
      </aside>
      <div className="flex flex-1 flex-col">
        {/* Mobile-only top bar: brand logo on navy, links home. Desktop uses the sidebar logo. */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-center border-b border-white/10 bg-brand-navy px-4 md:hidden">
          <CommandPaletteIconButton className="absolute start-2 top-1/2 -translate-y-1/2" />
          {/* Mobile bar is horizontal (56px tall) so a horizontal logo with the
              slogan reads cleanly. The horizontal art is light-bg; we mount it
              on a brand-cream chip so it stays brand-correct against the dark
              top bar instead of a stark white plate. */}
          <Link
            href="/"
            aria-label="מקובצקי — לדף הבית"
            className="flex items-center rounded-md bg-brand-cream px-3 py-1 shadow-sm transition-opacity hover:opacity-95"
          >
            <Image
              src="/logo-horizontal.png"
              alt="מקובצקי — ניהול פרויקטים · הביורוקרטיה — עלינו"
              width={600}
              height={300}
              priority
              className="h-9 w-auto object-contain"
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
