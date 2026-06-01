"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

// Mounts on the project-print page (and only there). On mount, flips
// document.body[data-printing="true"] so the @media print rules in
// globals.css kick in; on unmount, flips it back so going back to a
// regular page doesn't leave the chrome hidden on a re-print.
//
// Also renders the visible "הדפס / שמור כ-PDF" button that calls
// window.print() — the user can hit Ctrl+P too, but a button is cleaner
// for mobile / unfamiliar users.

export function PrintTrigger() {
  useEffect(() => {
    document.body.dataset.printing = "true";
    return () => {
      delete document.body.dataset.printing;
    };
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide="true"
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-[12px] font-medium hover:bg-accent"
    >
      <Printer className="size-3.5" />
      הדפס / שמור כ-PDF
    </button>
  );
}
