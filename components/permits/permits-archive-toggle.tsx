"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Archive, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

// Segmented pill that flips /permits between "active" (default) and "completed".
// Mirrors the TasksViewToggle pattern (Block 18): URL-encoded as `?archived=1`
// so the choice survives reload and is shareable. Counts are passed in from
// the server so users see what's hiding behind each tab.

export function PermitsArchiveToggle({
  active,
  activeCount,
  archivedCount
}: {
  active: "active" | "archived";
  activeCount: number;
  archivedCount: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (view: "active" | "archived") => {
    const q = new URLSearchParams(params.toString());
    if (view === "active") q.delete("archived");
    else q.set("archived", "1");
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5 shadow-sm"
      role="tablist"
      aria-label="סינון לפי סטטוס"
    >
      <ToggleLink
        href={hrefFor("active")}
        active={active === "active"}
        icon={<CircleDot className="size-3.5" />}
        label="פעילים"
        count={activeCount}
      />
      <ToggleLink
        href={hrefFor("archived")}
        active={active === "archived"}
        icon={<Archive className="size-3.5" />}
        label="הושלמו"
        count={archivedCount}
      />
    </div>
  );
}

function ToggleLink({
  href,
  active,
  icon,
  label,
  count
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
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
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] tabular-nums",
          active
            ? "bg-muted text-foreground"
            : "bg-background/80 text-muted-foreground"
        )}
      >
        {count}
      </span>
    </Link>
  );
}
