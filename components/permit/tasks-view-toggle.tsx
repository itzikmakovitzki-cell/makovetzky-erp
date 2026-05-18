"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarRange, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ViewKey = "table" | "timeline";

// Toggle between the dense Tasks table and the Gantt-style Timeline view.
// Encoded in the URL so the choice survives reload + sharing.
export function TasksViewToggle({ active }: { active: ViewKey }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (view: ViewKey) => {
    const q = new URLSearchParams(params.toString());
    if (view === "table") q.delete("view");
    else q.set("view", view);
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5 shadow-sm"
      role="tablist"
      aria-label="תצוגת משימות"
    >
      <ToggleLink
        href={hrefFor("table")}
        active={active === "table"}
        icon={<Table2 className="size-3.5" />}
        label="טבלה"
      />
      <ToggleLink
        href={hrefFor("timeline")}
        active={active === "timeline"}
        icon={<CalendarRange className="size-3.5" />}
        label="ציר זמן"
      />
    </div>
  );
}

function ToggleLink({
  href,
  active,
  icon,
  label
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
