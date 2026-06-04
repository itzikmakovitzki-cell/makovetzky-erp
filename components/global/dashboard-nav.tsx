"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  Calendar as CalendarIcon,
  ChevronDown,
  Coins,
  FileCheck2,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListTodo,
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

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

// Pinned rows render above the accordion and never collapse.
const PINNED: NavItem[] = [
  { href: "/", label: "מבט-על", icon: LayoutDashboard, allowed: ["ADMIN", "EMPLOYEE"] },
  { href: "/calendar", label: "לוח שנה", icon: CalendarIcon, allowed: ["ADMIN", "EMPLOYEE"] }
];

const GROUPS: NavGroup[] = [
  {
    id: "projects",
    label: "ניהול פרויקטים ועבודה",
    items: [
      { href: "/projects", label: "פרויקטים", icon: FolderKanban, allowed: ["ADMIN", "EMPLOYEE"] },
      { href: "/permits", label: "היתרים", icon: FileCheck2, allowed: ["ADMIN", "EMPLOYEE"] },
      { href: "/clients", label: "לקוחות", icon: Building2, allowed: ["ADMIN"] }
    ]
  },
  {
    id: "tasks",
    label: "משימות ותקשורת",
    items: [
      { href: "/my-tasks", label: "המשימות שלי", icon: ListTodo, allowed: ["ADMIN", "EMPLOYEE"] },
      { href: "/tasks", label: "כל המשימות", icon: ListChecks, allowed: ["ADMIN", "EMPLOYEE"] },
      { href: "/inbox", label: "תיבת WhatsApp", icon: Inbox, allowed: ["ADMIN", "EMPLOYEE"] }
    ]
  },
  {
    id: "finance",
    label: "כספים והתקשרויות",
    items: [
      { href: "/proposals", label: "הצעות מחיר", icon: FileText, allowed: ["ADMIN"] },
      { href: "/finances", label: "כספים", icon: Wallet, allowed: ["ADMIN"] },
      { href: "/suppliers", label: "ספקים", icon: Truck, allowed: ["ADMIN"] },
      {
        href: "/finances/supplier-commissions",
        label: "עמלות מספקים",
        icon: Coins,
        allowed: ["ADMIN"]
      }
    ]
  },
  {
    id: "admin",
    label: "כללי ומנהלה",
    items: [
      { href: "/guides", label: "מדריכים", icon: BookOpen, allowed: ["ADMIN", "EMPLOYEE"] },
      { href: "/settings", label: "הגדרות", icon: SettingsIcon, allowed: ["ADMIN"] }
    ]
  }
];

// User asked for "tasks" open on first paint.
const DEFAULT_OPEN_GROUP = "tasks";

function isItemActive(item: NavItem, pathname: string) {
  // "/" and "/finances" need exact match — see original NAV_ITEMS comment.
  const isExactOnly = item.href === "/" || item.href === "/finances";
  return isExactOnly
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function findActiveGroupId(pathname: string): string | null {
  for (const group of GROUPS) {
    if (group.items.some((item) => isItemActive(item, pathname))) return group.id;
  }
  return null;
}

export function DashboardNav({ role }: { role?: UserRole }) {
  const pathname = usePathname();
  const activeGroupId = findActiveGroupId(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(
    activeGroupId ?? DEFAULT_OPEN_GROUP
  );

  // Route changed into a different group → snap that group open so the
  // user can see where they landed. Manual collapses are NOT overridden
  // (openGroup excluded from deps on purpose).
  useEffect(() => {
    if (activeGroupId && activeGroupId !== openGroup) {
      setOpenGroup(activeGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  return (
    <nav className="flex flex-col gap-0.5 text-[13px]" aria-label="ניווט ראשי">
      {/* Pinned rows — always visible */}
      <div className="flex flex-col gap-0.5">
        {PINNED.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} role={role} />
        ))}
      </div>

      {/* Hairline separator between pinned and accordion */}
      <div className="my-1.5 border-t border-white/10" aria-hidden />

      {/* Accordion groups — single-open. Click open category to collapse it. */}
      <div className="flex flex-col gap-0.5">
        {GROUPS.map((group) => {
          const isOpen = openGroup === group.id;
          const panelId = `nav-group-${group.id}`;
          return (
            <div key={group.id} className="flex flex-col">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenGroup(isOpen ? null : group.id)}
                className="group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-[11px] font-semibold uppercase tracking-wider text-brand-cream/55 transition-colors hover:bg-white/5 hover:text-brand-cream/85"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-200 ease-out",
                    isOpen ? "rotate-0" : "-rotate-90"
                  )}
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="flex-1 truncate">{group.label}</span>
              </button>
              {/* CSS grid-rows trick: animates from 0fr → 1fr smoothly, no JS
                  height measurement, works with dynamic content. The inner
                  overflow-hidden is required for the clip during transition. */}
              <div
                id={panelId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="mt-0.5 flex flex-col gap-0.5 ps-2">
                    {group.items.map((item) => (
                      <NavRow
                        key={item.href}
                        item={item}
                        pathname={pathname}
                        role={role}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function NavRow({
  item,
  pathname,
  role
}: {
  item: NavItem;
  pathname: string;
  role?: UserRole;
}) {
  const isActive = isItemActive(item, pathname);
  const isAllowed = role ? item.allowed.includes(role) : true;
  if (!isAllowed) {
    return (
      <span
        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-1.5 text-white/30"
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
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-all duration-150",
        isActive
          ? "bg-primary font-medium text-primary-foreground shadow-sm"
          : "text-white/75 hover:bg-white/10 hover:text-white"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <span
          className="absolute inset-y-1 start-0 w-0.5 rounded-full bg-primary-foreground/60"
          aria-hidden
        />
      )}
      <item.icon
        className={cn(
          "size-4 shrink-0 transition-transform duration-150",
          isActive ? "scale-110" : "text-white/60 group-hover:text-white"
        )}
        strokeWidth={isActive ? 2.25 : 1.75}
      />
      <span className="flex-1 truncate">{item.label}</span>
    </Link>
  );
}
