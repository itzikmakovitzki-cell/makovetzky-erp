"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

// Filters the per-permit tasks list by the selected category (the "סיווג"
// column / Task.category). Categories shown are exactly those present on
// the current permit — passed in from the server. Updating the dropdown
// writes `?category=<value>` to the URL; the page reads the param and
// passes it through to TasksTable, which filters the prisma query.
export function TasksCategoryFilter({
  categories,
  current
}: {
  categories: string[];
  current: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setCategory(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("category", next);
    else params.delete("category");
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false
      });
    });
  }

  if (categories.length === 0) return null;

  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span>סיווג:</span>
      <select
        value={current ?? ""}
        onChange={(e) => setCategory(e.target.value)}
        disabled={pending}
        className="rounded border border-input bg-background px-1.5 py-0.5 text-[11px] tabular-nums hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">הכל ({categories.length})</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
    </label>
  );
}
