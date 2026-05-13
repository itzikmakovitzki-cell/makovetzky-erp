import Image from "next/image";
import { auth } from "@/auth";
import { DashboardNav } from "@/components/global/dashboard-nav";
import { UserMenu } from "@/components/global/user-menu";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware enforces auth, but we still read the session here to display the user.
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-l bg-muted/30 px-3 py-4">
        <div className="mb-5 flex items-center justify-center border-b border-border/60 pb-3">
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={40}
            height={40}
            priority
            className="size-10 object-contain"
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
      <main className="flex-1 overflow-auto px-6 py-5">{children}</main>
    </div>
  );
}
