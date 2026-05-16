"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { MilestoneStatus } from "@prisma/client";
import { MILESTONE_STATUS_LABEL } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

const STATUS_ORDER: MilestoneStatus[] = ["PENDING", "DUE", "PAID"];

export function FinancesFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatuses = new Set(
    (searchParams.get("status") ?? "").split(",").filter(Boolean) as MilestoneStatus[]
  );
  const hasAnyFilter = currentStatuses.size > 0;

  const toggleStatus = (s: MilestoneStatus) => {
    const next = new Set(currentStatuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    const csv = Array.from(next).join(",");
    const params = new URLSearchParams(searchParams.toString());
    if (csv) params.set("status", csv);
    else params.delete("status");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const clearAll = () => router.push(pathname);

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">סטטוס</span>
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_ORDER.map((s) => {
              const selected = currentStatuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[11px] transition-colors",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {MILESTONE_STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </div>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-2.5" />
            נקה סינון
          </button>
        )}
      </div>
    </div>
  );
}
