"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuditLogPagination({
  page,
  totalPages
}: {
  page: number;
  totalPages: number;
}) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (target: number) => {
    const q = new URLSearchParams(params.toString());
    if (target <= 1) q.delete("page");
    else q.set("page", String(target));
    const s = q.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="tabular-nums text-muted-foreground">
        עמוד {page} מתוך {totalPages}
      </span>
      <div className="flex items-center gap-1">
        {/* In RTL, "previous" is to the right visually, so the chevron-right
            icon matches "previous page". */}
        {prevDisabled ? (
          <span className={pageBtnDisabled}>
            <ChevronRight className="size-3" />
            הקודם
          </span>
        ) : (
          <Link href={hrefFor(page - 1)} className={pageBtn}>
            <ChevronRight className="size-3" />
            הקודם
          </Link>
        )}
        {nextDisabled ? (
          <span className={pageBtnDisabled}>
            הבא
            <ChevronLeft className="size-3" />
          </span>
        ) : (
          <Link href={hrefFor(page + 1)} className={pageBtn}>
            הבא
            <ChevronLeft className="size-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

const pageBtn = cn(
  "inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1",
  "hover:bg-accent"
);
const pageBtnDisabled = cn(
  "inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1",
  "cursor-not-allowed opacity-40"
);
