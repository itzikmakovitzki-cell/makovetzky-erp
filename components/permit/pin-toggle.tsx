"use client";

import { useTransition } from "react";
import { Pin } from "lucide-react";
import { toggleNotePin } from "@/app/actions/notes";
import { cn } from "@/lib/utils";

export function PinToggle({
  noteId,
  isPinned
}: {
  noteId: string;
  isPinned: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void toggleNotePin(noteId);
        })
      }
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
        isPinned
          ? "border-amber-500/50 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300"
          : "border-input text-muted-foreground hover:bg-accent hover:text-foreground",
        pending && "opacity-50"
      )}
      title={isPinned ? "בטל הצמדה" : "הצמד לראש הרשימה"}
    >
      <Pin
        className={cn("size-3", isPinned && "fill-amber-500 text-amber-600")}
      />
      {isPinned ? "מוצמד" : "הצמד"}
    </button>
  );
}
