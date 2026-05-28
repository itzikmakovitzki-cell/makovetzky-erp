"use client";

import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * A discreet trigger button that reveals its children inside a side Sheet.
 * Block 23 uses it to keep financial data fully hidden by default — nothing
 * sensitive renders on screen until the user explicitly opens the drawer.
 * Children are passed through (can be a server component rendered upstream).
 */
export function SheetButton({
  label,
  title,
  icon,
  children,
  tone = "default",
  className
}: {
  label: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** "finance" gives the brand-accent treatment for the money drawer trigger. */
  tone?: "default" | "finance";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
          tone === "finance"
            ? "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
            : "border-input bg-background hover:bg-accent hover:text-foreground",
          className
        )}
      >
        {icon}
        {label}
      </button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        side="end"
        returnFocusRef={triggerRef}
      >
        <div className="p-3">{children}</div>
      </Sheet>
    </>
  );
}
