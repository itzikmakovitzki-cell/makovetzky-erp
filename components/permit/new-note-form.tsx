"use client";

import { useRef, useState, useTransition } from "react";
import { Plus, Loader2 } from "lucide-react";
import { createNote } from "@/app/actions/notes";
import { cn } from "@/lib/utils";

export function NewNoteForm({ permitId }: { permitId: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && !pending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      try {
        await createNote(permitId, trimmed);
        setContent("");
        textareaRef.current?.focus();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה ביצירת ההערה");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-md border bg-card">
      <div className="border-b bg-muted/30 px-3 py-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          הוסף הערה חדשה
        </h3>
      </div>
      <div className="p-2.5">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="הקלד הערה. אפשר להשתמש ב-**מודגש** לטקסט מודגש."
          rows={3}
          className="w-full resize-y rounded border border-input bg-background px-2 py-1.5 text-[13px] leading-snug placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={pending}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="text-[10px] text-muted-foreground">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : (
              <span>
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">Ctrl</kbd>+
                <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[9px]">Enter</kbd>{" "}
                לשליחה מהירה (בקרוב)
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            שמור
          </button>
        </div>
      </div>
    </form>
  );
}
