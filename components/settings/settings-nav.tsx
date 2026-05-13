"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2, Box, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/settings/users", label: "משתמשים", icon: Users },
  { href: "/settings/authorities", label: "רשויות", icon: Building2 },
  { href: "/settings/building-types", label: "סוגי בניינים", icon: Box },
  { href: "/settings/templates", label: "תבניות משימות", icon: ListTodo }
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="border-b">
      <ul className="flex gap-0.5 text-sm">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 -mb-px transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                <item.icon className="size-3.5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
