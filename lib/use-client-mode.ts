"use client";

import * as React from "react";

const STORAGE_KEY = "makovetzky.dashboard.clientMode";
// Custom event so every consumer hook (toggle pill, shield wrappers, money
// cells) updates together when one of them flips the value.
const EVENT_NAME = "client-mode-changed";

// Privacy-by-default reads "0" as the *only* way to be off — missing/null,
// empty, or anything else means ON. This way, first-time admins and anyone
// who's never explicitly revealed see financials shielded.
function readFromStorage(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function writeToStorage(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Privacy mode / quota — fall through; in-memory state still propagates
    // via the custom event below.
  }
}

/**
 * Subscribes to the global "client mode" privacy flag.
 *
 * Returns `[on, setOn]`. `on === true` means the user wants financial
 * data hidden (default everywhere — see readFromStorage). Calling `setOn`
 * persists to localStorage and dispatches a window event so every other
 * consumer on the page updates in the same tick.
 */
export function useClientMode(): [boolean, (next: boolean) => void] {
  // During SSR / before hydration we render in the privacy-safe direction
  // (ON). Flicking off after hydration is acceptable; the inverse direction
  // (briefly exposing then hiding) is not.
  const [on, setOnState] = React.useState(true);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setOnState(readFromStorage());
    setHydrated(true);

    const onChange = (e: Event) => {
      const ce = e as CustomEvent<{ on: boolean }>;
      if (typeof ce.detail?.on === "boolean") setOnState(ce.detail.on);
    };
    // Cross-tab sync via the standard storage event.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setOnState(e.newValue !== "0");
    };
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setOn = React.useCallback((next: boolean) => {
    writeToStorage(next);
    setOnState(next);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(EVENT_NAME, { detail: { on: next } })
      );
    }
  }, []);

  // Before hydration, lock to ON regardless of what state has been set —
  // ensures the markup matches what the server rendered.
  return [hydrated ? on : true, setOn];
}
