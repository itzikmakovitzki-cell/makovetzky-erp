"use client";

import * as React from "react";

type BulkSelectionContextValue = {
  selectedIds: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setMany: (ids: string[], next: boolean) => void;
  clear: () => void;
  count: number;
};

const BulkSelectionContext = React.createContext<BulkSelectionContextValue | null>(
  null
);

// Provider holds a Set<string> of selected task ids. Components like checkboxes
// + the floating action bar read from this single source so toggling a row in
// the desktop table also reflects in the mobile cards (and vice versa, if the
// same page were to show both — which we do at /tasks below md). Scope: one
// provider per surface page (global /tasks, per-permit /tasks).
export function BulkSelectionProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  // Stable callbacks so child memoization (checkboxes are many) doesn't churn.
  const isSelected = React.useCallback(
    (id: string) => selected.has(id),
    [selected]
  );

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setMany = React.useCallback((ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) for (const id of ids) next.add(id);
      else for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => setSelected(new Set()), []);

  const value = React.useMemo<BulkSelectionContextValue>(
    () => ({
      selectedIds: Array.from(selected),
      isSelected,
      toggle,
      setMany,
      clear,
      count: selected.size
    }),
    [selected, isSelected, toggle, setMany, clear]
  );

  return (
    <BulkSelectionContext.Provider value={value}>
      {children}
    </BulkSelectionContext.Provider>
  );
}

export function useBulkSelection(): BulkSelectionContextValue {
  const ctx = React.useContext(BulkSelectionContext);
  if (!ctx) {
    throw new Error(
      "useBulkSelection must be used inside a <BulkSelectionProvider>"
    );
  }
  return ctx;
}
