// Pure parsers and the public-facing JSON shape for Proposal milestones.
//
// Extracted from app/actions/proposals.ts so the type + helpers can be
// imported by both the action layer and consumer files (proposal-form.tsx,
// quote/[id]/page.tsx, etc.) without dragging in the "use server" runtime.
// proposals.ts has a slightly different parseAmount than lib/validators/form
// (this one takes `unknown` and returns NaN on failure, suiting the
// JSON-parsed inputs proposals work with) — keeping them separate here on
// purpose.

// Public-facing milestone shape stored inside Proposal.milestones JSON column.
// Stays free-form until conversion materializes it into DealMilestone rows.
// triggerPercentage (1–100) is optional — when set, the eventual DealMilestone
// inherits it so the finances tab can render a live progress bar against it.
export type ProposalMilestoneJson = {
  description: string;
  amount: number;
  dueDate?: string | null;
  triggerPercentage?: number | null;
};

// Strict normaliser for the milestones JSON column. Drops rows missing a
// description or with a negative / non-finite amount; clamps amounts to two
// decimals; bounds triggerPercentage to [1, 100]; accepts ISO date strings
// only. Returns an empty array when the input isn't an array at all.
export function parseMilestonesPayload(raw: unknown): ProposalMilestoneJson[] {
  if (!Array.isArray(raw)) return [];
  const out: ProposalMilestoneJson[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const description = String(obj.description ?? "").trim();
    const amountNum = Number(obj.amount);
    if (!description) continue;
    if (!Number.isFinite(amountNum) || amountNum < 0) continue;
    const dueRaw = obj.dueDate;
    let dueDate: string | null = null;
    if (typeof dueRaw === "string" && dueRaw.trim()) {
      const d = new Date(dueRaw);
      if (!Number.isNaN(d.getTime())) dueDate = d.toISOString();
    }
    const pctRaw = obj.triggerPercentage;
    let triggerPercentage: number | null = null;
    if (pctRaw !== null && pctRaw !== undefined && pctRaw !== "") {
      const n = Number(pctRaw);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 100) {
        triggerPercentage = n;
      }
    }
    out.push({
      description,
      amount: Math.round(amountNum * 100) / 100,
      dueDate,
      triggerPercentage
    });
  }
  return out;
}

// Loose amount parser — accepts unknown (JSON-decoded values, query params,
// etc.), strips comma thousands-separators, rounds to two decimals. Returns
// NaN on invalid / negative input so the caller can short-circuit with a
// `Number.isNaN()` check. Different contract from lib/validators/form's
// parseAmount, which takes a FormDataEntryValue and returns `null`.
export function parseAmount(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}
