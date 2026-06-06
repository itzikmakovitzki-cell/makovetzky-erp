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
    <nav className="border-b">
      <ul className="flex gap-0.5 text-sm">
        {TABS.map((tab) => {
          const href = `/permits/${permitId}/${tab.segment}`;
          const isActive = pathname.startsWith(href);
          const count = counts?.[tab.segment];
          return (
            <li key={tab.segment}>
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 -mb-px transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                )}
              >
                {tab.label}
                {typeof count === "number" && (
                  <span className="rounded bg-muted px-1 text-[10px] font-medium">{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
