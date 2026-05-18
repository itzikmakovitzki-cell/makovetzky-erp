"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Side = "bottom" | "top";
type Align = "start" | "end";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  side: Side;
  align: Align;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownContext() {
  const ctx = React.useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu subcomponents must be used inside <DropdownMenu>");
  return ctx;
}

export function DropdownMenu({
  children,
  side = "bottom",
  align = "end"
}: {
  children: React.ReactNode;
  side?: Side;
  align?: Align;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, menuRef, side, align }}>
      {children}
    </DropdownMenuContext.Provider>
  );
}

export const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function DropdownMenuTrigger({ className, onClick, ...props }, _forwardedRef) {
  const { open, setOpen, triggerRef } = useDropdownContext();
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      className={cn(
        "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      {...props}
    />
  );
});

export function DropdownMenuContent({
  children,
  className,
  sideOffset = 6
}: {
  children: React.ReactNode;
  className?: string;
  sideOffset?: number;
}) {
  const { open, setOpen, triggerRef, menuRef, side, align } = useDropdownContext();
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Compute placement relative to the trigger.
  React.useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const compute = () => {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger || !menu) return;
      const t = trigger.getBoundingClientRect();
      const m = menu.getBoundingClientRect();
      const top = side === "bottom" ? t.bottom + sideOffset : t.top - m.height - sideOffset;
      const left =
        align === "end"
          ? t.right - m.width
          : t.left;
      // Clamp to viewport with an 8px gutter.
      const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - m.width - 8));
      const clampedTop = Math.max(8, Math.min(top, window.innerHeight - m.height - 8));
      setPosition({ top: clampedTop, left: clampedLeft });
    };
    compute();
    const raf = requestAnimationFrame(() => setVisible(true));
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, side, align, sideOffset, triggerRef, menuRef]);

  // Click outside + Esc to close.
  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, triggerRef, menuRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      dir="rtl"
      className={cn(
        "fixed z-[55] min-w-[10rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg transition-all duration-150 ease-out",
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95",
        className
      )}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        transformOrigin: side === "bottom" ? "top" : "bottom"
      }}
    >
      {children}
    </div>,
    document.body
  );
}

type ItemProps = {
  children: React.ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
  icon?: React.ReactNode;
  className?: string;
};

export function DropdownMenuItem({
  children,
  onSelect,
  disabled,
  variant = "default",
  icon,
  className
}: ItemProps) {
  const { setOpen, triggerRef } = useDropdownContext();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        setOpen(false);
        // Defer the action so the menu unmount doesn't race with the handler
        // (e.g. opening a sheet that traps focus while we're still inside the menu's
        // click handler).
        setTimeout(() => {
          onSelect?.();
          // Don't auto-return focus when the action moves focus elsewhere
          // (e.g. opens a sheet) — only when the action was a no-op.
          if (document.activeElement === document.body) {
            triggerRef.current?.focus();
          }
        }, 0);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variant === "destructive"
          ? "text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10"
          : "text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent",
        className
      )}
    >
      {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="flex-1 text-start">{children}</span>
    </button>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("my-1 h-px bg-border", className)} role="separator" />;
}

export function DropdownMenuLabel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}
