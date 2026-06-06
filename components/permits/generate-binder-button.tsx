"use client";

import { useState } from "react";
import { FolderArchive, Loader2 } from "lucide-react";

// Block 41 — 1-click municipality binder.
//
// One shared component used in two surfaces:
//   * Back-office permit dashboard header  — variant="primary",
//     label "הפק קלסר לעירייה (ZIP)".
//   * Portal docs tab header                — variant="ghost",
//     label "הורד קלסר מסמכים מלא".
//
// Both surfaces hit the same /api/permit-binder/<permitId>; auth on
// that endpoint enforces the role gates. The fetch streams the
// response as a blob and triggers a synthetic download, with a
// spinner shown until the bytes are received (cold-start bundling
// of 30+ PDFs can take 20-40 s).

const LABELS = {
  primary: "הפק קלסר לעירייה (ZIP)",
  ghost: "הורד קלסר מסמכים מלא"
} as const;

export function GenerateBinderButton({
  permitId,
  variant = "primary"
}: {
  permitId: string;
  variant?: "primary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(`/api/permit-binder/${permitId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `נכשל (${res.status})`);
      }
      const total = res.headers.get("X-Binder-Total");
      const included = res.headers.get("X-Binder-Included");
      const skipped = res.headers.get("X-Binder-Skipped");

      const blob = await res.blob();
      // Pull the server-provided filename if present (RFC 5987-encoded
      // Hebrew); otherwise build a generic one.
      const cd = res.headers.get("Content-Disposition") || "";
      const utf8Match = cd.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : `permit-${permitId.slice(-8)}-binder.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      // Surface skipped/legacy-external docs so the PM knows the ZIP
      // isn't complete and shouldn't be sent without checking.
      if (skipped && Number(skipped) > 0) {
        window.alert(
          `הקלסר הופק. ${included}/${total} מסמכים נכללו. ${skipped} מסמכים לא נכללו (חיצוניים או נכשלה הורדה) — ראה רשימת מסמכים בתוך ה-ZIP.`
        );
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "הפקת הקלסר נכשלה");
    } finally {
      setLoading(false);
    }
  }

  const label = LABELS[variant];

  if (variant === "primary") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="מבנה אותם בקובץ ZIP אחד עם רשימת מסמכים"
        className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FolderArchive className="size-3.5" />
        )}
        {loading ? "מכין קלסר…" : label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title="הורד את כל מסמכי ההיתר בקובץ ZIP אחד"
      className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1 text-[11.5px] hover:bg-accent disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <FolderArchive className="size-3.5" />
      )}
      {loading ? "מכין קלסר…" : label}
    </button>
  );
}
