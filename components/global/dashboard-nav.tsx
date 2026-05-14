"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings as SettingsIcon,
  Truck,
  Wallet,
  Lock
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof FileCheck2;
  allowed: UserRole[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "מבט-על", icon: LayoutDashboard, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/permits", label: "היתרים", icon: FileCheck2, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/clients", label: "לקוחות", icon: Building2, allowed: ["ADMIN"] },
  { href: "/tasks", label: "משימות", icon: ListChecks, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/inbox", label: "תיבת WhatsApp", icon: Inbox, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/finances", label: "כספים", icon: Wallet, allowed: ["ADMIN"] },
  { href: "/suppliers", label: "ספקים", icon: Truck, allowed: ["ADMIN"] },
  { href: "/settings", label: "הגדרות", icon: SettingsIcon, allowed: ["ADMIN"] }
];

export function DashboardNav({ role }: { role?: UserRole }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV_ITEMS.map((item) => {
        // The home entry uses "/" as its href, which would match every path
        // under the naive startsWith check — special-case to exact match.
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const isAllowed = role ? item.allowed.includes(role) : true;
        if (!isAllowed) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-foreground/30"
              title="אין הרשאה — מיועד למנהל"
            >
              <item.icon className="size-4" />
              {item.label}
              <Lock className="ms-auto size-3" />
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded px-2 py-1.5 transition-colors",
              isActive
                ? "bg-foreground text-background"
                : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
