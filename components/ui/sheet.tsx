"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  // Element to return focus to when the sheet closes (e.g. the trigger button).
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  returnFocusRef
}: SheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => setMounted(true), []);

  // Two-phase: render in DOM first (translate-y-full), then animate to translate-y-0
  // on the next frame so the slide-up transition actually plays.
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

  return createPortal(
    <div
      className="fixed inset-0 z-[60] md:hidden"
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
          "absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-2xl border-t bg-background shadow-2xl transition-transform duration-200 ease-out",
          visible ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-foreground/20" aria-hidden />
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onOpenChange(false)}
            className="-me-1 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="סגור"
          >
            <X className="size-4" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]"
          dir="rtl"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
