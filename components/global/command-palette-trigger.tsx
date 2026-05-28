"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

// Opens the global command palette. Decoupled from <CommandPalette /> via a
// window event so the trigger can live anywhere (sidebar, mobile bar) without
// shared React context across the server-rendered layout.
function openPalette() {
  window.dispatchEvent(new Event("open-command-palette"));
}

export function CommandPaletteTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="חיפוש מהיר"
      className={cn(
        "flex w-full items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-brand-navy-muted transition-colors hover:bg-white/10 hover:text-brand-navy-foreground",
        className
      )}
    >
      <Search className="size-3.5 shrink-0" />
      <span className="flex-1 text-start">חיפוש מהיר…</span>
      <kbd className="rounded border border-white/15 bg-white/5 px-1 py-0.5 text-[9px] leading-none">
        Ctrl K
      </kbd>
    </button>
  );
}

export function CommandPaletteIconButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openPalette}
      aria-label="חיפוש מהיר"
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-brand-navy-foreground/90 transition-colors hover:bg-white/10",
        className
      )}
    >
      <Search className="size-4" />
    </button>
  );
}
