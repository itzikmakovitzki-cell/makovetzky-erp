"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Archive, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

// Generic segmented pill that flips a list view between "active" (default) and
// "completed/archived". URL-encoded as `?archived=1` so the choice survives
// reload and is shareable. Used on /permits and /projects (and reusable
// anywhere a list has a terminal state worth hiding by default).
//
// First shipped as components/permits/permits-archive-toggle.tsx in PR #38;
// promoted to global in PR-A of the post-suppliers polish sweep so /projects
// can use the same UI without copy-paste.

export function ArchiveToggle({
  active,
  activeCount,
  archivedCount,
  activeLabel = "פעילים",
  archivedLabel = "הושלמו"
}: {
  active: "active" | "archived";
  activeCount: number;
  archivedCount: number;
  activeLabel?: string;
  archivedLabel?: string;
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
      className="inline-flex items-center gap-1 rounded-xl border border-white/80 bg-white/80 p-1 shadow-sm"
      role="tablist"
      aria-label="סינון לפי סטטוס"
    >
      <ToggleLink
        href={hrefFor("active")}
        active={active === "active"}
        icon={<CircleDot className="size-3.5" />}
        label={activeLabel}
        count={activeCount}
      />
      <ToggleLink
        href={hrefFor("archived")}
        active={active === "archived"}
        icon={<Archive className="size-3.5" />}
        label={archivedLabel}
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
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200",
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
