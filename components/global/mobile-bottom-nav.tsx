"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  Calendar as CalendarIcon,
  Coins,
  FileCheck2,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Truck,
  Wallet
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { signOutAction } from "@/app/actions/auth";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Slot = {
  href: string;
  label: string;
  icon: typeof FileCheck2;
  allowed: UserRole[];
};

// Primary mobile slots — the always-visible bottom row. Mirror the desktop
// sidebar's PINNED list ("/" + "/calendar") so the daily-use anchors are
// one tap away on phone too. The rest move to the "More" sheet below.
const PRIMARY_SLOTS: Slot[] = [
  { href: "/", label: "מבט-על", icon: LayoutDashboard, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/calendar", label: "לוח שנה", icon: CalendarIcon, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/projects", label: "פרויקטים", icon: FolderKanban, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/permits", label: "היתרים", icon: FileCheck2, allowed: ["ADMIN", "EMPLOYEE"] }
];

// Everything not in PRIMARY_SLOTS — surfaced via the "More" sheet.
const OVERFLOW_SLOTS: Slot[] = [
  { href: "/my-tasks", label: "המשימות שלי", icon: ListTodo, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/tasks", label: "משימות", icon: ListChecks, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/clients", label: "לקוחות", icon: Building2, allowed: ["ADMIN"] },
  { href: "/inbox", label: "תיבת WhatsApp", icon: Inbox, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/proposals", label: "הצעות מחיר", icon: FileText, allowed: ["ADMIN"] },
  { href: "/finances", label: "כספים", icon: Wallet, allowed: ["ADMIN"] },
  { href: "/suppliers", label: "ספקים", icon: Truck, allowed: ["ADMIN"] },
  {
    href: "/finances/supplier-commissions",
    label: "עמלות מספקים",
    icon: Coins,
    allowed: ["ADMIN"]
  },
  { href: "/guides", label: "מדריכים", icon: BookOpen, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/settings", label: "הגדרות", icon: SettingsIcon, allowed: ["ADMIN"] }
];

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "מנהל",
  EMPLOYEE: "עובד",
  CONTRACTOR: "קבלן"
};

const ROLE_DOT: Record<UserRole, string> = {
  ADMIN: "bg-amber-500",
  EMPLOYEE: "bg-sky-500",
  CONTRACTOR: "bg-zinc-400"
};

function isRouteActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav({
  role,
  user
}: {
  role?: UserRole;
  user?: { name?: string | null; email?: string | null } | null;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);

  const visiblePrimary = PRIMARY_SLOTS.filter((s) =>
    role ? s.allowed.includes(role) : true
  );
  const visibleOverflow = OVERFLOW_SLOTS.filter((s) =>
    role ? s.allowed.includes(role) : true
  );

  const moreActive = visibleOverflow.some((s) => isRouteActive(pathname, s.href));

  // Close the sheet automatically when the route changes (e.g. user taps an item).
  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="ניווט תחתון"
      >
        <ul className="flex h-16 items-stretch justify-around">
          {visiblePrimary.map((slot) => {
            const active = isRouteActive(pathname, slot.href);
            return (
              <li key={slot.href} className="flex-1">
                <Link
                  href={slot.href}
                  className={cn(
                    "relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors active:bg-muted/50",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <span
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                      aria-hidden
                    />
                  )}
                  <slot.icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  <span className="text-[10px] font-medium leading-none">{slot.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-1 transition-colors active:bg-muted/50",
                moreActive ? "text-foreground" : "text-muted-foreground"
              )}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
            >
              {moreActive && (
                <span
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-foreground"
                  aria-hidden
                />
              )}
              <Menu className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium leading-none">עוד</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title="ניווט"
        returnFocusRef={moreButtonRef}
        side="bottom"
        showAt="mobile"
      >
        <div className="flex flex-col">
          <ul className="flex flex-col py-1">
            {visibleOverflow.map((slot) => {
              const active = isRouteActive(pathname, slot.href);
              return (
                <li key={slot.href}>
                  <Link
                    href={slot.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 px-4 transition-colors active:bg-muted/70",
                      active ? "bg-muted/40 text-foreground" : "text-foreground hover:bg-muted/50"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <slot.icon className="size-5 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{slot.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {user && role && (
            <div className="mt-2 border-t bg-muted/20 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={cn("inline-block size-2 rounded-full", ROLE_DOT[role])} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name ?? "—"}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {ROLE_LABEL[role]} · {user.email ?? "—"}
                  </div>
                </div>
              </div>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-accent active:bg-muted/70"
                >
                  <LogOut className="size-4" />
                  התנתק
                </button>
              </form>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
