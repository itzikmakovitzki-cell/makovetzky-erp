"use client";

import { useTransition } from "react";
import { Star } from "lucide-react";
import { toggleTaskSpotlight } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

export function SpotlightToggle({
  taskId,
  isSpotlight
}: {
  taskId: string;
  isSpotlight: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(() => {
          void toggleTaskSpotlight(taskId);
        })
      }
      className={cn(
        "inline-flex items-center justify-center rounded p-0.5 hover:bg-accent transition-colors",
        pending && "opacity-50"
      )}
      aria-label={isSpotlight ? "הסר Managerial Spotlight" : "סמן כ-Managerial Spotlight"}
      title={isSpotlight ? "Managerial Spotlight פעיל — לחץ להסרה" : "סמן כ-Managerial Spotlight"}
    >
      <Star
        className={cn(
          "size-3 transition-colors",
          isSpotlight
            ? "fill-yellow-500 text-yellow-500"
            : "text-muted-foreground/40 hover:text-foreground"
        )}
      />
    </button>
  );
}
