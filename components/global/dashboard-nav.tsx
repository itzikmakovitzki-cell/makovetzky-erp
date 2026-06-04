"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  Box,
  Building2,
  Calendar as CalendarIcon,
  ChevronDown,
  Coins,
  FileCheck2,
  FileText,
  FolderKanban,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MessageCircle,
  Settings as SettingsIcon,
  Store,
  Trash2,
  Truck,
  Users,
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
  // When present the row renders as a nested-accordion toggle:
  // main row links to `href`, an inline chevron button expands/collapses
  // the children below.
  children?: NavItem[];
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

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
      },
      {
        href: "/partners",
        label: "מאגר שותפים",
        icon: Store,
        allowed: ["ADMIN", "EMPLOYEE"]
      }
    ]
  },
  {
    id: "admin",
    label: "כללי ומנהלה",
    items: [
      { href: "/guides", label: "מדריכים", icon: BookOpen, allowed: ["ADMIN", "EMPLOYEE"] },
      {
        href: "/settings",
        label: "הגדרות",
        icon: SettingsIcon,
        allowed: ["ADMIN"],
        children: [
          { href: "/settings/users", label: "משתמשים", icon: Users, allowed: ["ADMIN"] },
          { href: "/settings/authorities", label: "רשויות", icon: Building2, allowed: ["ADMIN"] },
          { href: "/settings/building-types", label: "סוגי בניינים", icon: Box, allowed: ["ADMIN"] },
          { href: "/settings/templates", label: "תבניות משימות", icon: ListTodo, allowed: ["ADMIN"] },
          { href: "/settings/partner-categories", label: "קטגוריות שותפים", icon: Store, allowed: ["ADMIN"] },
          { href: "/settings/whatsapp", label: "WhatsApp", icon: MessageCircle, allowed: ["ADMIN"] },
          { href: "/settings/audit-log", label: "יומן פעולות", icon: History, allowed: ["ADMIN"] },
          { href: "/settings/recycle-bin", label: "סל המחזור", icon: Trash2, allowed: ["ADMIN"] }
        ]
      }
    ]
  }
];

const DEFAULT_OPEN_GROUP = "tasks";

function isItemActive(item: NavItem, pathname: string) {
  // "/" and "/finances" need exact match. For items with children (e.g.
  // /settings), the parent is "active" whenever any sub-path matches —
  // which startsWith already handles.
  const isExactOnly = item.href === "/" || item.href === "/finances";
  return isExactOnly
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function findActiveGroupId(pathname: string): string | null {
  for (const group of GROUPS) {
    for (const item of group.items) {
      if (isItemActive(item, pathname)) return group.id;
      if (item.children?.some((c) => isItemActive(c, pathname))) return group.id;
    }
  }
  return null;
}

function findInitialOpenSubmenus(pathname: string): Set<string> {
  const s = new Set<string>();
  for (const group of GROUPS) {
    for (const item of group.items) {
      if (item.children && pathname.startsWith(`${item.href}/`)) {
        s.add(item.href);
      }
    }
  }
  return s;
}

export function DashboardNav({ role }: { role?: UserRole }) {
  const pathname = usePathname();
  const activeGroupId = findActiveGroupId(pathname);
  const [openGroup, setOpenGroup] = useState<string | null>(
    activeGroupId ?? DEFAULT_OPEN_GROUP
  );
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(() =>
    findInitialOpenSubmenus(pathname)
  );

  // Snap the relevant category open when the route lands inside it.
  useEffect(() => {
    if (activeGroupId && activeGroupId !== openGroup) {
      setOpenGroup(activeGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId]);

  // Snap a submenu open if the user navigates into a sub-path of it
  // (e.g. lands on /settings/users → make sure the הגדרות sub-menu is open).
  useEffect(() => {
    const needed = findInitialOpenSubmenus(pathname);
    if (needed.size === 0) return;
    setOpenSubmenus((prev) => {
      let next = prev;
      let changed = false;
      for (const href of needed) {
        if (!next.has(href)) {
          if (!changed) {
            next = new Set(next);
            changed = true;
          }
          next.add(href);
        }
      }
      return changed ? next : prev;
    });
  }, [pathname]);

  const toggleSubmenu = (href: string) => {
    setOpenSubmenus((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });
  };

  return (
    <nav className="flex flex-col gap-0.5 text-[13px]" aria-label="ניווט ראשי">
      <div className="flex flex-col gap-0.5">
        {PINNED.map((item) => (
          <NavRow key={item.href} item={item} pathname={pathname} role={role} />
        ))}
      </div>

      <div className="my-1.5 border-t border-white/10" aria-hidden />

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
              <div
                id={panelId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
              >
                <div className="overflow-hidden">
                  <div className="mt-0.5 flex flex-col gap-0.5 ps-2">
                    {group.items.map((item) =>
                      item.children ? (
                        <ExpandableNavRow
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          role={role}
                          isExpanded={openSubmenus.has(item.href)}
                          onToggle={() => toggleSubmenu(item.href)}
                        />
                      ) : (
                        <NavRow
                          key={item.href}
                          item={item}
                          pathname={pathname}
                          role={role}
                        />
                      )
                    )}
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

// Whole-row toggle (same pattern as the outer category headers). Click
// anywhere on the row opens/closes the nested sub-menu. The parent route
// (/settings) isn't directly clickable from the sidebar — it ultimately
// redirects to /settings/users which is the first sub-item anyway.
function ExpandableNavRow({
  item,
  pathname,
  role,
  isExpanded,
  onToggle
}: {
  item: NavItem;
  pathname: string;
  role?: UserRole;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isAllowed = role ? item.allowed.includes(role) : true;
  // Parent reads "active" whenever any of its sub-items is the current
  // route — gives the user a visual home base in the sidebar.
  const isActive =
    isItemActive(item, pathname) ||
    (item.children?.some((c) => isItemActive(c, pathname)) ?? false);
  const panelId = `nav-sub-${item.href.replace(/\//g, "-")}`;

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
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start transition-all duration-150",
          isActive
            ? "bg-primary font-medium text-primary-foreground shadow-sm"
            : "text-white/75 hover:bg-white/10 hover:text-white"
        )}
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
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200 ease-out",
            isExpanded ? "rotate-0" : "-rotate-90",
            isActive ? "opacity-90" : "opacity-60"
          )}
          strokeWidth={2}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          {/* ps-5 = parent icon (size-4) + gap (gap-2.5) ≈ 28-30px; visually
              hangs the children off the parent's label axis. */}
          <div className="mt-0.5 flex flex-col gap-0.5 ps-5">
            {item.children?.map((child) => (
              <NavRow
                key={child.href}
                item={child}
                pathname={pathname}
                role={role}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
