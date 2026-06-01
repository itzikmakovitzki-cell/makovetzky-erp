"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Calendar, CalendarDays, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

// Period preset shapes for the commissions-owed dashboard. Custom is the
// escape hatch — exposes two date inputs.
//
//   month       = the current calendar month (1st → today, inclusive)
//   last-month  = the previous calendar month (full range)
//   ytd         = Jan 1st of the current year → today
//   custom      = uses ?from=YYYY-MM-DD&to=YYYY-MM-DD from the URL
//
// Encoded in the URL (`?period=...`) so the choice survives reload and is
// shareable. The server-side page reads the same params and computes its
// effective date window.

export type PeriodPreset = "month" | "last-month" | "ytd" | "custom";

export function CommissionsPeriodFilter({
  active,
  fromDate,
  toDate
}: {
  active: PeriodPreset;
  fromDate: string | null;
  toDate: string | null;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (preset: PeriodPreset) => {
    const q = new URLSearchParams(params.toString());
    q.set("period", preset);
    // Clear from/to unless we're going into custom mode — otherwise stale
    // values would linger on the URL.
    if (preset !== "custom") {
      q.delete("from");
      q.delete("to");
    }
    return `${pathname}?${q.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5 shadow-sm"
        role="tablist"
        aria-label="טווח זמן"
      >
        <PresetLink
          href={hrefFor("month")}
          active={active === "month"}
          icon={<Calendar className="size-3.5" />}
          label="החודש"
        />
        <PresetLink
          href={hrefFor("last-month")}
          active={active === "last-month"}
          icon={<Calendar className="size-3.5" />}
          label="חודש שעבר"
        />
        <PresetLink
          href={hrefFor("ytd")}
          active={active === "ytd"}
          icon={<CalendarRange className="size-3.5" />}
          label="מתחילת השנה"
        />
        <PresetLink
          href={hrefFor("custom")}
          active={active === "custom"}
          icon={<CalendarDays className="size-3.5" />}
          label="טווח מותאם"
        />
      </div>
      {active === "custom" && (
        <form
          method="get"
          className="flex flex-wrap items-end gap-2 text-[11px]"
        >
          <input type="hidden" name="period" value="custom" />
          <label className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">מתאריך</span>
            <input
              type="date"
              name="from"
              defaultValue={fromDate ?? ""}
              className="rounded border border-input bg-background px-2 py-1 text-[11px]"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-[10px] text-muted-foreground">עד תאריך</span>
            <input
              type="date"
              name="to"
              defaultValue={toDate ?? ""}
              className="rounded border border-input bg-background px-2 py-1 text-[11px]"
            />
          </label>
          <button
            type="submit"
            className="rounded border border-input bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground hover:brightness-110"
          >
            החל
          </button>
        </form>
      )}
    </div>
  );
}

function PresetLink({
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
