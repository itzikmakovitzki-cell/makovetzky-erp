"use client";

import * as React from "react";
import { useBulkSelection } from "@/lib/use-bulk-selection";
import { cn } from "@/lib/utils";

// Single-row checkbox. Used inside every row of the desktop table and as an
// overlay on each mobile card. Tap stops propagation so wrapping <Link>
// elements (mobile cards) don't navigate while you're selecting.
export function TaskBulkCheckbox({
  taskId,
  className
}: {
  taskId: string;
  className?: string;
}) {
  const { isSelected, toggle } = useBulkSelection();
  const checked = isSelected(taskId);
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex size-5 cursor-pointer items-center justify-center rounded border bg-background transition-colors hover:border-foreground/40",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-input",
        className
      )}
      aria-label={checked ? "הסר בחירה" : "בחר משימה"}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          toggle(taskId);
        }}
      />
      {checked && (
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3 fill-none stroke-current stroke-[2.5]"
        >
          <path d="M3 8.5l3 3 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </label>
  );
}

// "Select all visible" header checkbox. Three states: unchecked / indeterminate
// / checked. Toggles the whole `visibleIds` set in one click.
export function TaskBulkSelectAll({
  visibleIds,
  className
}: {
  visibleIds: string[];
  className?: string;
}) {
  const { selectedIds, setMany } = useBulkSelection();
  const ref = React.useRef<HTMLInputElement>(null);

  const visibleSet = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const selectedVisible = selectedIds.filter((id) => visibleSet.has(id));
  const allSelected =
    visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected =
    selectedVisible.length > 0 && !allSelected;

  // Native indeterminate state is set imperatively — React doesn't model it.
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "inline-flex size-5 cursor-pointer items-center justify-center rounded border bg-background transition-colors hover:border-foreground/40",
        allSelected
          ? "border-foreground bg-foreground text-background"
          : someSelected
            ? "border-foreground/60 bg-foreground/10"
            : "border-input",
        className
      )}
      aria-label={allSelected ? "בטל בחירה לכל הנראים" : "בחר את כל הנראים"}
    >
      <input
        ref={ref}
        type="checkbox"
        className="sr-only"
        checked={allSelected}
        onChange={() => setMany(visibleIds, !allSelected)}
      />
      {allSelected ? (
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3 fill-none stroke-current stroke-[2.5]"
        >
          <path d="M3 8.5l3 3 6.5-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : someSelected ? (
        <span className="block size-2 rounded-sm bg-foreground/70" aria-hidden />
      ) : null}
    </label>
  );
}
