"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy, Link2, Loader2, X } from "lucide-react";
import { generateMagicLink } from "@/app/actions/magic-links";
import { cn, formatDateTime } from "@/lib/utils";

export function MagicLinkButton({
  taskId,
  taskName
}: {
  taskId: string;
  taskName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = !!result || !!error;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => {
      setResult(null);
      setError(null);
      setCopied(false);
    };
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, []);

  const handleClick = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await generateMagicLink(taskId);
      if (res.ok && res.url && res.expiresAt) {
        setResult({ url: res.url, expiresAt: res.expiresAt });
      } else {
        setError(res.error ?? "שגיאה ביצירת הקישור");
      }
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail (insecure context, etc.) — fall back to select.
      const input = document.getElementById("magic-link-url") as HTMLInputElement | null;
      input?.select();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center justify-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        title="צור קישור גישה לעובד שטח"
        aria-label="צור קישור גישה"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Link2 className="size-3.5" />
        )}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[520px] max-w-[calc(100vw-2rem)]"
      >
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">קישור גישה לעובד שטח</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          <div className="text-[11px] text-muted-foreground">
            עבור משימה: <span className="font-medium text-foreground">{taskName}</span>
          </div>

          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[12px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {result && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium">קישור (העתק ושלח ב-WhatsApp)</label>
                <div className="flex items-center gap-1">
                  <input
                    id="magic-link-url"
                    type="text"
                    value={result.url}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1.5 text-[11px] font-medium transition-colors",
                      copied
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                        : "border-foreground bg-foreground text-background hover:opacity-90"
                    )}
                  >
                    {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied ? "הועתק" : "העתק"}
                  </button>
                </div>
              </div>

              <div className="rounded border border-amber-500/40 bg-amber-50/40 px-2 py-1.5 text-[11px] text-amber-900 dark:bg-amber-500/5 dark:text-amber-200">
                <strong>תוקף עד:</strong> {formatDateTime(result.expiresAt)} · אחרי תוקף, הקישור יחזיר שגיאה. צור חדש בכל עת.
              </div>
              <div className="text-[10px] text-muted-foreground leading-relaxed">
                עובד השטח יוכל להעלות קבצים למשימה הזו <strong>בלי צורך בסיסמה</strong>. כל העלאה תיכנס לטאב המסמכים של ההיתר עם סימון "מקור: MAGIC_LINK" ב-Audit Log.
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
          >
            סגור
          </button>
        </div>
      </dialog>
    </>
  );
}
