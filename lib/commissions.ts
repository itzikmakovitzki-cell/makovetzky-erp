import type { SupplierCommissionType } from "@prisma/client";

// Phase 4 utilities for the supplier-commissions dashboard at
// /finances/supplier-commissions. Pure functions — no DB / network.

export type PeriodPreset = "month" | "last-month" | "ytd" | "custom";

export type PeriodWindow = {
  preset: PeriodPreset;
  // Local Israel-time boundaries, normalised so the server query is
  // [from, to) — inclusive start, exclusive end. Both required when the
  // preset is "custom" and the user submitted dates; otherwise computed
  // from now().
  from: Date;
  to: Date;
  // For UI display ("חודש מאי 2026" / "01.06.26 – 30.06.26").
  label: string;
};

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר"
];

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfNextDay(d: Date): Date {
  const out = startOfDay(d);
  out.setDate(out.getDate() + 1);
  return out;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function parseDateInput(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatHe(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

// Resolve a (preset + optional from/to) into a concrete [from, to) window
// plus a human label. `now` is parameterised so callers can pin a clock for
// testing or for "as-of" reports.
export function resolvePeriod(
  preset: PeriodPreset,
  fromRaw: string | undefined,
  toRaw: string | undefined,
  now: Date = new Date()
): PeriodWindow {
  if (preset === "month") {
    const from = startOfMonth(now);
    const to = startOfNextDay(now);
    return {
      preset,
      from,
      to,
      label: `${HEBREW_MONTHS[from.getMonth()]} ${from.getFullYear()}`
    };
  }
  if (preset === "last-month") {
    const from = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const to = startOfMonth(now); // exclusive end = start of current month
    return {
      preset,
      from,
      to,
      label: `${HEBREW_MONTHS[from.getMonth()]} ${from.getFullYear()}`
    };
  }
  if (preset === "ytd") {
    const from = startOfYear(now);
    const to = startOfNextDay(now);
    return {
      preset,
      from,
      to,
      label: `מתחילת ${from.getFullYear()}`
    };
  }
  // custom
  const fromParsed = parseDateInput(fromRaw);
  const toParsed = parseDateInput(toRaw);
  if (fromParsed && toParsed) {
    const from = startOfDay(fromParsed);
    const to = startOfNextDay(toParsed); // inclusive UI → exclusive query
    return {
      preset,
      from,
      to,
      label: `${formatHe(from)} – ${formatHe(toParsed)}`
    };
  }
  // Custom selected but no dates submitted yet — fall back to month so the
  // page renders something usable until the form is filled.
  const from = startOfMonth(now);
  const to = startOfNextDay(now);
  return {
    preset: "custom",
    from,
    to,
    label: "טווח מותאם — בחר תאריכים"
  };
}

export function isValidPreset(raw: string | undefined): raw is PeriodPreset {
  return raw === "month" || raw === "last-month" || raw === "ytd" || raw === "custom";
}

// Validate a commission (type, value) pair as accepted from a form. Used by
// both Supplier.defaultCommission* (suppliers.ts) and SupplierTaskAssignment
// overrides (supplier-assignments.ts) — the two flows read different
// FormData field names but share the same validation rules:
//
// - Both empty → "inherit / no override" (ok, type=null, value=null)
// - Type without value or value without type → error
// - Type must be FIXED or PERCENT
// - Value must be a non-negative number
// - PERCENT values must be ≤ 100
//
// Returns the typed pair plus the value formatted as a 2-decimal string
// (the shape suppliers.ts/supplier-assignments.ts feed straight into Prisma
// `Decimal` columns), or { ok: false, error } with a Hebrew message ready to
// surface in the form.
export function validateCommissionPair(
  typeRaw: string,
  valueRaw: string
):
  | { ok: true; type: SupplierCommissionType | null; value: string | null }
  | { ok: false; error: string } {
  const t = typeRaw.trim();
  const v = valueRaw.trim();

  if (!t && !v) return { ok: true, type: null, value: null };
  if (t && !v) {
    return { ok: false, error: "ערך עמלה חסר — סימנת סוג בלי מספר" };
  }
  if (v && !t) {
    return { ok: false, error: "סוג עמלה חסר — מילאת מספר בלי לבחור 'סכום' או 'אחוז'" };
  }
  if (t !== "FIXED" && t !== "PERCENT") {
    return { ok: false, error: "סוג עמלה לא חוקי" };
  }
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) {
    return { ok: false, error: "ערך עמלה חייב להיות מספר אי-שלילי" };
  }
  if (t === "PERCENT" && n > 100) {
    return { ok: false, error: "אחוז עמלה לא יכול להיות מעל 100" };
  }
  return {
    ok: true,
    type: t as SupplierCommissionType,
    value: n.toFixed(2)
  };
}

// Resolve the commission amount for a single assignment. Returns null when
// neither the assignment nor the supplier define a commission, OR when the
// type is PERCENT but the dependency value (amount) is null. The caller
// decides whether to render "—" or fall back to estimating.
export function resolveCommissionAmount(args: {
  override: { type: SupplierCommissionType | null; value: number | null };
  supplierDefault: { type: SupplierCommissionType | null; value: number | null };
  // Used as the base for PERCENT resolution. Optional — phase 2 stores it
  // on SupplierTaskAssignment.amount.
  baseAmount: number | null;
}): number | null {
  const type = args.override.type ?? args.supplierDefault.type;
  const value = args.override.value ?? args.supplierDefault.value;
  if (!type || value === null) return null;
  if (type === "FIXED") return value;
  // PERCENT
  if (args.baseAmount === null) return null;
  return Math.round((args.baseAmount * value) / 100 * 100) / 100;
}
