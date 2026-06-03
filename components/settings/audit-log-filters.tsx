"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Filter row for the audit log page. Each control writes its value to the
// URL search params so deep-links + back/forward work. "Reset" clears
// everything except the page param (handled by useRouter.push(pathname)).

export function AuditLogFilters({
  entityOptions,
  actionOptions,
  userOptions,
  currentEntity,
  currentEntityId,
  currentAction,
  currentUser,
  currentFrom,
  currentTo
}: {
  entityOptions: string[];
  actionOptions: { value: string; label: string }[];
  userOptions: { id: string; name: string }[];
  currentEntity: string | null;
  currentEntityId: string | null;
  currentAction: string | null;
  currentUser: string | null;
  currentFrom: string | null;
  currentTo: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    // Always reset to page 1 when a filter changes — otherwise an empty
    // result page is the most likely outcome.
    next.delete("page");
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  // Clear deep-link drill-down (entityType + entityId) but keep the rest
  // of the filters the user might have applied on top.
  const clearEntityId = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("entityId");
    next.delete("entityType");
    next.delete("page");
    const q = next.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
  };

  const hasAny =
    !!currentEntity ||
    !!currentEntityId ||
    !!currentAction ||
    !!currentUser ||
    !!currentFrom ||
    !!currentTo;

  return (
    <div className="rounded-md border bg-card px-3 py-2">
      {currentEntityId && (
        <div className="mb-2 flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1 text-[11px]">
          <span className="font-semibold text-primary">מסונן לפי ישות:</span>
          <code className="font-mono text-[10px] text-muted-foreground">
            {currentEntityId}
          </code>
          <button
            type="button"
            onClick={clearEntityId}
            className="ms-auto inline-flex items-center gap-1 rounded border border-input bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-2.5" />
            הצג הכל
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2 text-[11px]">
        <FilterGroup label="סוג ישות">
          <select
            value={currentEntity ?? ""}
            onChange={(e) => setParam("entity", e.target.value || null)}
            className={selectCls}
          >
            <option value="">הכל</option>
            {entityOptions.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </FilterGroup>
        <FilterGroup label="פעולה">
          <select
            value={currentAction ?? ""}
            onChange={(e) => setParam("action", e.target.value || null)}
            className={selectCls}
          >
            <option value="">הכל</option>
            {actionOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </FilterGroup>
        <FilterGroup label="משתמש">
          <select
            value={currentUser ?? ""}
            onChange={(e) => setParam("user", e.target.value || null)}
            className={cn(selectCls, "max-w-[14rem]")}
          >
            <option value="">הכל</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </FilterGroup>
        <FilterGroup label="מתאריך">
          <input
            type="date"
            value={currentFrom ?? ""}
            onChange={(e) => setParam("from", e.target.value || null)}
            className={selectCls}
          />
        </FilterGroup>
        <FilterGroup label="עד תאריך">
          <input
            type="date"
            value={currentTo ?? ""}
            onChange={(e) => setParam("to", e.target.value || null)}
            className={selectCls}
          />
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

const selectCls =
  "rounded border border-input bg-background px-2 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring";

function FilterGroup({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
