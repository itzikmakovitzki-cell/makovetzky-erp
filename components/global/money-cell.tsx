"use client";

import * as React from "react";
import { useClientMode } from "@/lib/use-client-mode";
import { cn } from "@/lib/utils";

// Wraps a single monetary value (or any sensitive numeric/string cell) so
// that it inherits the global client-mode flag — when ON, the content is
// blurred + select-disabled in place. Use for individual table cells where a
// full <ClientModeShield> wrapper isn't practical (one shield per row would
// be lots of state, plus the toggle should live elsewhere).
export function MoneyCell({
  children,
  className,
  // Width to keep the blurred area visually stable. Defaults to "inline-block
  // so blur affects only the content"; pass an explicit width when the cell
  // would otherwise collapse to 0 (e.g. when the underlying string is
  // entirely whitespace).
  inline
}: {
  children: React.ReactNode;
  className?: string;
  inline?: boolean;
}) {
  const [clientMode] = useClientMode();
  return (
    <span
      className={cn(
        inline ? "inline-block" : "inline-flex",
        "transition-[filter] duration-200",
        clientMode && "select-none blur-sm",
        className
      )}
      aria-hidden={clientMode ? "true" : undefined}
    >
      {children}
    </span>
  );
}
