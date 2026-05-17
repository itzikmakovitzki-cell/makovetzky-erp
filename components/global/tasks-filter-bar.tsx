"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Star, X } from "lucide-react";
import type { TaskResponsibility, TaskStatus } from "@prisma/client";
import { TASK_RESPONSIBILITY_LABEL, TASK_STATUS_LABEL } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

const STATUS_ORDER: TaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_AUTHORITY",
  "BLOCKED",
  "COMPLETED"
];

const RESPONSIBILITY_ORDER: TaskResponsibility[] = [
  "INTERNAL",
  "CLIENT",
  "CONTRACTOR",
  "AUTHORITY"
];

export function TasksFilterBar({
  users,
  categories,
  tags
}: {
  users: { id: string; name: string }[];
  categories: string[];
  tags: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentAssignee = searchParams.get("assignee") ?? "";
  const currentStatuses = new Set(
    (searchParams.get("status") ?? "").split(",").filter(Boolean) as TaskStatus[]
  );
  const currentSpotlight = searchParams.get("spotlight") === "true";
  const currentCategory = searchParams.get("category") ?? "";
  const currentResponsibilities = new Set(
    (searchParams.get("responsibility") ?? "")
      .split(",")
      .filter(Boolean) as TaskResponsibility[]
  );
  const currentTag = searchParams.get("tag") ?? "";

  const hasAnyFilter =
    currentAssignee !== "" ||
    currentStatuses.size > 0 ||
    currentSpotlight ||
    currentCategory !== "" ||
    currentResponsibilities.size > 0 ||
    currentTag !== "";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const toggleStatus = (s: TaskStatus) => {
    const next = new Set(currentStatuses);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    const csv = Array.from(next).join(",");
    setParam("status", csv || null);
  };

  const toggleResponsibility = (r: TaskResponsibility) => {
    const next = new Set(currentResponsibilities);
    if (next.has(r)) next.delete(r);
    else next.add(r);
    const csv = Array.from(next).join(",");
    setParam("responsibility", csv || null);
  };

  const clearAll = () => {
    router.push(pathname);
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <FilterGroup label="אחראי">
          <select
            value={currentAssignee}
            onChange={(e) => setParam("assignee", e.target.value || null)}
            className="rounded border border-input bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">כל האחראים</option>
            <option value="unassigned">לא משויך</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="סטטוס">
          <div className="flex flex-wrap items-center gap-1">
            {STATUS_ORDER.map((s) => {
              const selected = currentStatuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {TASK_STATUS_LABEL[s]}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label="קטגוריה">
          <select
            value={currentCategory}
            onChange={(e) => setParam("category", e.target.value || null)}
            className="rounded border border-input bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="אחריות">
          <div className="flex flex-wrap items-center gap-1">
            {RESPONSIBILITY_ORDER.map((r) => {
              const selected = currentResponsibilities.has(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleResponsibility(r)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    selected
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {TASK_RESPONSIBILITY_LABEL[r]}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label="תגית">
          <select
            value={currentTag}
            onChange={(e) => setParam("tag", e.target.value || null)}
            className="rounded border border-input bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">כל התגיות</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup label="">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={currentSpotlight}
              onChange={(e) =>
                setParam("spotlight", e.target.checked ? "true" : null)
              }
              className="size-3.5"
            />
            <Star
              className={cn(
                "size-3",
                currentSpotlight
                  ? "fill-yellow-500 text-yellow-500"
                  : "text-muted-foreground"
              )}
            />
            Spotlight בלבד
          </label>
        </FilterGroup>

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
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

function FilterGroup({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
