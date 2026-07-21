"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "tasks", label: "משימות" },
  { segment: "finances", label: "כספים" },
  { segment: "documents", label: "מסמכים" },
  { segment: "contacts", label: "אנשי קשר" },
  { segment: "notes", label: "הערות" },
  { segment: "audit", label: "יומן שינויים" }
];

export function PermitTabs({
  permitId,
  counts
}: {
  permitId: string;
  counts?: Partial<Record<(typeof TABS)[number]["segment"], number>>;
}) {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto rounded-2xl border border-white/80 bg-white/90 p-1.5 shadow-sm [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 text-sm">
        {TABS.map((tab) => {
          const href = `/permits/${permitId}/${tab.segment}`;
          const isActive = pathname.startsWith(href);
          const count = counts?.[tab.segment];
          return (
            <li key={tab.segment}>
              <Link
                href={href}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 font-semibold transition-colors duration-200",
                  isActive
                    ? "bg-brand-navy text-brand-cream shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {tab.label}
                {typeof count === "number" && (
                  <span className={cn("rounded-full px-1.5 text-[10px] font-bold", isActive ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
