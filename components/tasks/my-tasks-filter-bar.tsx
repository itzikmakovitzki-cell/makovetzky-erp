"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { projectColor } from "@/lib/project-color";

const TIMEFRAMES = [
  { value: "today", label: "היום" },
  { value: "week", label: "השבוע" },
  { value: "month", label: "החודש" }
] as const;

const STATES = [
  { value: "active", label: "פעיל" },
  { value: "waiting", label: "ממתין" },
  { value: "overdue", label: "באיחור" }
] as const;

export function MyTasksFilterBar({
  projects,
  categories
}: {
  projects: { id: string; name: string }[];
  // Distinct Task.category values across the user's tasks. Empty means no
  // categorised tasks → the dropdown hides itself.
  categories: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const project = searchParams.get("project") ?? "";
  const category = searchParams.get("category") ?? "";
  const timeframe = searchParams.get("timeframe") ?? "";
  const state = searchParams.get("state") ?? "";

  const hasAny =
    project !== "" || category !== "" || timeframe !== "" || state !== "";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  // Single-select toggle: clicking the active pill clears it.
  const toggleParam = (key: string, value: string) =>
    setParam(key, searchParams.get(key) === value ? null : value);

  return (
    <div className="rounded-2xl border border-white/80 bg-white/90 shadow-[0_8px_28px_rgba(31,41,55,0.06)] backdrop-blur">
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3 px-4 py-4">
        <FilterGroup label="פרויקט">
          <select
            value={project}
            onChange={(e) => setParam("project", e.target.value || null)}
            className="min-h-11 max-w-[14rem] cursor-pointer truncate rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="סינון לפי פרויקט"
          >
            <option value="">כל הפרויקטים</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {project && (
            <span
              aria-hidden
              className={cn("size-2 rounded-full", projectColor(project).dot)}
            />
          )}
        </FilterGroup>

        {categories.length > 0 && (
          <FilterGroup label="סיווג">
            <select
              value={category}
              onChange={(e) => setParam("category", e.target.value || null)}
              className="min-h-11 max-w-[12rem] cursor-pointer truncate rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="סינון לפי סיווג"
            >
              <option value="">כל הסיווגים</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FilterGroup>
        )}

        <FilterGroup label="טווח זמן">
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((t) => (
              <Pill
                key={t.value}
                active={timeframe === t.value}
                onClick={() => toggleParam("timeframe", t.value)}
              >
                {t.label}
              </Pill>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="מצב">
          <div className="flex items-center gap-1">
            {STATES.map((s) => (
              <Pill
                key={s.value}
                active={state === s.value}
                onClick={() => toggleParam("state", s.value)}
                tone={s.value === "overdue" ? "danger" : "default"}
              >
                {s.label}
              </Pill>
            ))}
          </div>
        </FilterGroup>

        {hasAny && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="ms-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-2.5" />
            נקה סינון
          </button>
        )}
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  tone = "default",
  children
}: {
  active: boolean;
  onClick: () => void;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-3 py-2 text-xs font-semibold transition-colors duration-200",
        active
          ? tone === "danger"
            ? "border-red-600 bg-red-600 text-white"
            : "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span className="text-[11px] font-bold text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
