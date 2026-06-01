"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Compact renderer for the oldValue / newValue JSONB blobs on each audit
// row. Collapsed by default — a one-line summary of the keys involved;
// expanded shows the full JSON pretty-printed. The JSON viewer is local
// to the row, no global state, so expanding many rows is fine.

export function AuditLogJsonCell({
  oldValue,
  newValue
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  const [open, setOpen] = useState(false);

  const hasOld = isMeaningful(oldValue);
  const hasNew = isMeaningful(newValue);
  if (!hasOld && !hasNew) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  const summary = collapsedSummary({ oldValue, newValue });

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronLeft className="size-3 shrink-0" />
        )}
        <span className="truncate">{summary}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="font-semibold text-muted-foreground">לפני</div>
            <pre
              className={cn(
                "mt-0.5 max-h-40 overflow-auto rounded bg-muted/40 p-1.5 font-mono text-[10px]",
                !hasOld && "text-muted-foreground"
              )}
              dir="ltr"
            >
              {hasOld ? JSON.stringify(oldValue, null, 2) : "—"}
            </pre>
          </div>
          <div>
            <div className="font-semibold text-muted-foreground">אחרי</div>
            <pre
              className={cn(
                "mt-0.5 max-h-40 overflow-auto rounded bg-muted/40 p-1.5 font-mono text-[10px]",
                !hasNew && "text-muted-foreground"
              )}
              dir="ltr"
            >
              {hasNew ? JSON.stringify(newValue, null, 2) : "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "object" && Object.keys(v as object).length === 0) return false;
  return true;
}

// One-line key list to hint what changed without forcing the user to expand.
// Picks the most "interesting" view: if both old + new exist, list the
// union of keys; otherwise show whichever side has data.
function collapsedSummary({
  oldValue,
  newValue
}: {
  oldValue: unknown;
  newValue: unknown;
}): string {
  const keys = new Set<string>();
  if (oldValue && typeof oldValue === "object") {
    for (const k of Object.keys(oldValue as object)) keys.add(k);
  }
  if (newValue && typeof newValue === "object") {
    for (const k of Object.keys(newValue as object)) keys.add(k);
  }
  if (keys.size === 0) return "ללא נתונים";
  return `שדות: ${[...keys].join(" · ")}`;
}
