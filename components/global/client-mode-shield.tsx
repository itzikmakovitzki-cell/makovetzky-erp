"use client";

import * as React from "react";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "makovetzky.dashboard.clientMode";

// Wraps the financial section of the dashboard and renders a "Client Mode"
// toggle at the top. When enabled the wrapped content is blurred + click-
// disabled so the admin can scroll past it next to a client without leaking
// numbers. State is persisted in localStorage per-browser.
export function ClientModeShield({ children }: { children: React.ReactNode }) {
  // Two flags: `mounted` so the first paint matches the SSR (no flicker on
  // hydration); `clientMode` is the actual toggle value.
  const [mounted, setMounted] = React.useState(false);
  const [clientMode, setClientMode] = React.useState(false);

  React.useEffect(() => {
    try {
      setClientMode(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage can throw under strict privacy modes — ignore.
    }
    setMounted(true);
  }, []);

  const persist = (next: boolean) => {
    setClientMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* see above */
    }
  };

  return (
    <section
      className="flex flex-col gap-3"
      data-client-mode={mounted && clientMode ? "on" : "off"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">כספים</h2>
          <span className="text-[10px] text-muted-foreground">
            סכומים, חיובים, וגבייה
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={mounted && clientMode}
          aria-label="מצב לקוח — הסתרת נתונים פיננסיים"
          onClick={() => persist(!clientMode)}
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
            mounted && clientMode
              ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
              : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {mounted && clientMode ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
          <span>מצב לקוח</span>
          {/* Switch track */}
          <span
            className={cn(
              "relative inline-block h-3.5 w-7 rounded-full transition-colors duration-200",
              mounted && clientMode ? "bg-amber-500" : "bg-foreground/20"
            )}
            aria-hidden
          >
            <span
              className={cn(
                "absolute top-0.5 size-2.5 rounded-full bg-background shadow transition-all duration-200",
                mounted && clientMode ? "end-0.5" : "start-0.5"
              )}
            />
          </span>
        </button>
      </div>

      {/* Children are the financial widgets. They keep being rendered (so the
          numbers are ready instantly when the toggle flips off) but are
          visually + interactively shielded when client mode is on. */}
      <div className="relative">
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-300",
            mounted &&
              clientMode &&
              "pointer-events-none select-none blur-md opacity-60"
          )}
          aria-hidden={mounted && clientMode ? "true" : undefined}
          inert={mounted && clientMode ? true : undefined}
        >
          {children}
        </div>
        {mounted && clientMode && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-8">
            <div className="rounded-md border border-amber-500/40 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-800 shadow-sm dark:bg-amber-500/20 dark:text-amber-200">
              נתונים פיננסיים מוסתרים — לחץ "מצב לקוח" כדי לבטל.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
