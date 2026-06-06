"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

// Block 40 — "Magic" button. Generates an auto-filled PDF declaration
// for the task and triggers a browser download. Hidden for completed
// tasks (no value in regenerating a closed-out form).
//
// The button does its own fetch + blob trick so we can show a spinner
// while the server renders, then create an object URL + synthetic <a>
// click for the download. A plain <a href> with `download` would also
// work, but it gives no loading feedback on slow connections.

export function GenerateFormButton({
  taskId,
  taskName,
  variant = "compact"
}: {
  taskId: string;
  taskName: string;
  // "compact" — icon-only square button for dense table rows.
  // "labeled" — icon + "טופס" label for the portal row's button strip.
  variant?: "compact" | "labeled";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/permit-form/${taskId}`, { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const blob = await res.blob();
      // Pull the server-provided filename if present; otherwise build one.
      const cd = res.headers.get("Content-Disposition") || "";
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : `טופס דיווח - ${taskName}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after the browser has a chance to start the download.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפקת הטופס נכשלה");
      window.alert(error ?? "הפקת הטופס נכשלה");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="הפק טופס ממולא מראש"
        aria-label="הפק טופס ממולא מראש"
        className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Sparkles className="size-3" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="הפק טופס ממולא מראש"
      className="inline-flex shrink-0 items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      <span className="hidden sm:inline">הפק טופס</span>
    </button>
  );
}
