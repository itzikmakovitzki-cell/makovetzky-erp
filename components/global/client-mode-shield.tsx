"use client";

import * as React from "react";
import { Eye, EyeOff, Wallet } from "lucide-react";
import { useClientMode } from "@/lib/use-client-mode";
import { cn } from "@/lib/utils";

// Wraps a financial section and renders a "Client Mode" toggle at the top.
// Privacy-by-default: the wrapped content starts BLURRED on every page load
// until the user explicitly clicks "Reveal". State lives in
// useClientMode() (localStorage + cross-component event sync) so the toggle
// here and any <MoneyCell> elsewhere on the page move together.
export function ClientModeShield({
  children,
  // When `false` the header (label + toggle) is hidden — useful when the
  // surrounding page already renders its own toggle and the shield only
  // needs to provide the blur wrapper.
  showHeader = true,
  title = "כספים",
  subtitle = "סכומים, חיובים, וגבייה"
}: {
  children: React.ReactNode;
  showHeader?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [clientMode, setClientMode] = useClientMode();

  return (
    <section
      className="flex flex-col gap-3"
      data-client-mode={clientMode ? "on" : "off"}
    >
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          </div>
          <ClientModeToggleButton
            on={clientMode}
            onChange={(next) => setClientMode(next)}
          />
        </div>
      )}

      {/* Children stay rendered (so flipping the toggle off has zero
          re-fetch latency) but are visually + interactively shielded when
          client mode is on. */}
      <div className="relative">
        <div
          className={cn(
            "flex flex-col gap-3 transition-all duration-300",
            clientMode &&
              "pointer-events-none select-none blur-md opacity-60"
          )}
          aria-hidden={clientMode ? "true" : undefined}
          inert={clientMode ? true : undefined}
        >
          {children}
        </div>
        {clientMode && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-8">
            <div className="rounded-md border border-amber-500/40 bg-amber-50/95 px-3 py-1.5 text-[11px] font-medium text-amber-800 shadow-sm dark:bg-amber-500/20 dark:text-amber-200">
              נתונים פיננסיים מוסתרים — לחץ "חשוף" כדי להציג.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// Standalone toggle pill. Can be dropped into any page header to flip the
// global client-mode flag — useful where the shield wrapper sits lower in
// the layout.
export function ClientModeToggle() {
  const [on, setOn] = useClientMode();
  return <ClientModeToggleButton on={on} onChange={setOn} />;
}

function ClientModeToggleButton({
  on,
  onChange
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "חשוף נתונים פיננסיים" : "הסתר נתונים פיננסיים"}
      onClick={() => onChange(!on)}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
        on
          ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      )}
    >
      {on ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      <span>{on ? "מוסתר — לחץ לחשיפה" : "חשוף — לחץ להסתרה"}</span>
      {/* Switch track */}
      <span
        className={cn(
          "relative inline-block h-3.5 w-7 rounded-full transition-colors duration-200",
          on ? "bg-amber-500" : "bg-emerald-500"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full bg-background shadow transition-all duration-200",
            on ? "end-0.5" : "start-0.5"
          )}
        />
      </span>
    </button>
  );
}
