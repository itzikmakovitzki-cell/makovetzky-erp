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
  projects
}: {
  projects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const project = searchParams.get("project") ?? "";
  const timeframe = searchParams.get("timeframe") ?? "";
  const state = searchParams.get("state") ?? "";

  const hasAny = project !== "" || timeframe !== "" || state !== "";

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
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <FilterGroup label="פרויקט">
          <select
            value={project}
            onChange={(e) => setParam("project", e.target.value || null)}
            className="max-w-[14rem] truncate rounded border border-input bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
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
            className="ms-auto inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
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
        "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
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
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
