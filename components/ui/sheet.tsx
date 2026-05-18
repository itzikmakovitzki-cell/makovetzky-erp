"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetSide = "bottom" | "end";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  // Element to return focus to when the sheet closes (e.g. the trigger button).
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  // "bottom" — slides up from the bottom (used by the mobile nav).
  // "end"    — slides in from the logical end-side (right in LTR, left in RTL); used for desktop edit panels.
  side?: SheetSide;
  // Restrict where the sheet renders by viewport. Pass "mobile" to only show below md;
  // "desktop" to only show at md and up; omit to show everywhere.
  showAt?: "mobile" | "desktop";
};

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  returnFocusRef,
  side = "bottom",
  showAt
}: SheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  // Two-phase: render in DOM first off-screen, then animate to the rest position
  // on the next frame so the slide transition actually plays.
  React.useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    return;
  }, [open]);

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Focus the close button when open; return focus on close.
  React.useEffect(() => {
    if (open) {
      // Wait for the slide-in to settle so we don't fight the transition.
      const id = window.setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
    returnFocusRef?.current?.focus();
    return;
  }, [open, returnFocusRef]);

  if (!mounted || !open) return null;

  const isBottom = side === "bottom";
  const viewportClass =
    showAt === "mobile" ? "md:hidden" : showAt === "desktop" ? "hidden md:block" : "";

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[60]", viewportClass)}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "absolute inset-0 bg-foreground/40 transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "absolute flex flex-col bg-background shadow-2xl transition-transform duration-200 ease-out",
          isBottom
            ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t"
            : "inset-y-0 start-0 w-full max-w-md border-e",
          isBottom
            ? visible
              ? "translate-y-0"
              : "translate-y-full"
            : visible
              ? "translate-x-0"
              : // Start off-screen in the logical start direction. In RTL, the logical
                // start is the right edge of the viewport, so translateX(+100%) hides it
                // off the right; that direction is automatically mirrored by the
                // browser via the dir="rtl" on <html>.
                "-translate-x-full rtl:translate-x-full",
          className
        )}
      >
        {isBottom && (
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/20" aria-hidden />
        )}
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b border-border/60 px-4",
            isBottom ? "pb-2 pt-3" : "py-3"
          )}
        >
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="-me-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="סגור"
          >
            <X className="size-4" />
          </button>
        </div>
        <div
          className={cn(
            "flex-1 overflow-y-auto",
            isBottom && "pb-[env(safe-area-inset-bottom)]"
          )}
          dir="rtl"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
