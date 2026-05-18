import Image from "next/image";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/global/dashboard-nav";
import { MobileBottomNav } from "@/components/global/mobile-bottom-nav";
import { UserMenu } from "@/components/global/user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware enforces auth, but we still read the session here to display the user.
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-l border-border/60 bg-muted/30 px-3 py-4 md:flex md:sticky md:top-0 md:h-screen">
        <div className="mb-4 flex items-center justify-center border-b border-border/60 pb-3">
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={480}
            height={203}
            priority
            className="h-auto w-full max-w-[200px] object-contain"
          />
        </div>
        <DashboardNav role={user?.role} />
        {user && (
          <UserMenu
            name={user.name ?? "—"}
            email={user.email ?? "—"}
            role={user.role}
          />
        )}
      </aside>
      <main className="flex-1 overflow-auto px-4 py-4 pb-24 md:px-6 md:py-5 md:pb-5">
        {children}
      </main>
      <MobileBottomNav
        role={user?.role}
        user={user ? { name: user.name, email: user.email } : null}
      />
    </div>
  );
}
