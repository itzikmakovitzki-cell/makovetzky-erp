"use client";

import { useEffect, useState } from "react";
import { StickyNote, X } from "lucide-react";

const STORAGE_KEY = "makovetzky-scratchpad";

// Block 25: persistent floating scratchpad ("פנקס טיוטה"). Bottom-right on every
// dashboard page; content survives reloads via localStorage. Sits above the
// mobile bottom nav (bottom-20) and tucks to the corner on desktop (md:bottom-4).
export function Scratchpad() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    try {
      setValue(window.localStorage.getItem(STORAGE_KEY) ?? "");
    } catch {
      /* localStorage unavailable (private mode) — start empty */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaved(false);
    const id = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
        setSaved(true);
      } catch {
        /* ignore quota / unavailable */
      }
    }, 300);
    return () => clearTimeout(id);
  }, [value, loaded]);

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-4 print:hidden">
      {open ? (
        <div
          dir="rtl"
          className="flex w-72 flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <StickyNote className="size-3.5 text-primary" aria-hidden />
              פנקס טיוטה
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {saved ? "נשמר" : "שומר…"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגור פנקס טיוטה"
                className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </span>
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="רשום כאן הערות מהירות… (נשמר אוטומטית)"
            className="h-48 w-full resize-none bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="פתח פנקס טיוטה"
          title="פנקס טיוטה"
          className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:brightness-110"
        >
          <StickyNote className="size-5" />
          {loaded && value.trim() && (
            <span
              className="absolute end-0 top-0 size-3 rounded-full bg-red-500 ring-2 ring-background"
              aria-hidden
            />
          )}
        </button>
      )}
    </div>
  );
}
