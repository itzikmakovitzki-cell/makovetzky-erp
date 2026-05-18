"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileCheck2,
  FileText,
  FolderKanban,
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
  { href: "/proposals", label: "הצעות מחיר", icon: FileText, allowed: ["ADMIN"] },
  { href: "/projects", label: "פרויקטים", icon: FolderKanban, allowed: ["ADMIN", "EMPLOYEE"] },
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
    <nav className="flex flex-col gap-0.5 text-[13px]" aria-label="ניווט ראשי">
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
              className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-foreground/30"
              title="אין הרשאה — מיועד למנהל"
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate">{item.label}</span>
              <Lock className="size-3 shrink-0" />
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            // Relative anchor lets the active stripe sit on the row's logical-start edge.
            className={cn(
              "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-all duration-150",
              isActive
                ? "bg-foreground font-medium text-background shadow-sm"
                : "text-foreground/75 hover:bg-accent hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {isActive && (
              <span
                className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-background/60"
                aria-hidden
              />
            )}
            <item.icon
              className={cn(
                "size-4 shrink-0 transition-transform duration-150",
                isActive ? "scale-110" : "text-foreground/60 group-hover:text-foreground"
              )}
              strokeWidth={isActive ? 2.25 : 1.75}
            />
            <span className="flex-1 truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
