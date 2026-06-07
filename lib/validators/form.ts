// Shared FormData parsers for server actions.
//
// Before this lived here, parseAmount + parseDate were duplicated across
// app/actions/milestones.ts, projects.ts, supplier-assignments.ts. The
// implementations had drifted in tiny ways (parseDate returned the same
// value with slightly different control flow); consolidating keeps the
// rounding/validation contract single-sourced.
//
// Not used by app/actions/proposals.ts — that file's parseAmount has a
// different signature (`unknown` → `number` with NaN on failure) because
// it parses already-decoded JSON values rather than FormData. Keep the
// two contracts separate until a real need to unify them appears.

// Parse a positive money amount from a FormData entry. Trims, strips
// thousand-separator commas, rejects negative/NaN, rounds to 2 decimals.
// Returns null for empty / invalid input — the caller decides what null means.
export function parseAmount(raw: FormDataEntryValue | null): number | null {
  if (raw === null) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const n = Number(str.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

// Parse a date from a FormData entry (or raw string — both call sites exist).
// Accepts anything `new Date()` recognises (ISO yyyy-mm-dd from <input type=date>
// is the common case). Returns null for empty / unparseable input.
export function parseDate(
  raw: FormDataEntryValue | null | string | undefined
): Date | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Parse a non-negative integer from a FormData entry. Floors, rejects
// negative/NaN. Returns `fallback` (default 0) on empty / invalid input.
export function parseIntField(
  raw: FormDataEntryValue | null,
  fallback = 0
): number {
  if (raw === null) return fallback;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}
