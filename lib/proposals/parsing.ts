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

export type ProposalFormFields = {
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  projectLocation: string | null;
  totalAmount: number;
  terms: string | null;
  quoteTitle: string | null;
  serviceDescription: string | null;
  pricesIncludeVat: boolean;
  milestones: ProposalMilestoneJson[];
};

// Shared by createProposal and updateProposal (app/actions/proposals.ts) —
// both read the exact same field set off the same form and apply the same
// required-field / milestone-sum validation before touching the DB.
export function parseProposalFormFields(
  formData: FormData
): { ok: true; fields: ProposalFormFields } | { ok: false; error: string } {
  const customerName = String(formData.get("customerName") || "").trim();
  const customerPhone = String(formData.get("customerPhone") || "").trim();
  const customerEmail =
    String(formData.get("customerEmail") || "").trim() || null;
  const projectLocation =
    String(formData.get("projectLocation") || "").trim() || null;
  const totalAmount = parseAmount(formData.get("totalAmount"));
  const terms = String(formData.get("terms") || "").trim() || null;
  const quoteTitle = String(formData.get("quoteTitle") || "").trim() || null;
  const serviceDescription =
    String(formData.get("serviceDescription") || "").trim() || null;
  // Boolean from a form: "true" / "false". Default = true (כולל מע״מ).
  const pricesIncludeVat =
    String(formData.get("pricesIncludeVat") || "true") !== "false";

  if (!customerName) return { ok: false, error: "שם הלקוח חובה" };
  if (!customerPhone) return { ok: false, error: "טלפון הלקוח חובה" };
  if (Number.isNaN(totalAmount)) {
    return { ok: false, error: "סכום כולל לא חוקי" };
  }

  const milestonesRaw = String(formData.get("milestones") || "[]");
  let milestones: ProposalMilestoneJson[];
  try {
    milestones = parseMilestonesPayload(JSON.parse(milestonesRaw));
  } catch {
    return { ok: false, error: "פורמט אבני הדרך לא חוקי" };
  }
  if (milestones.length === 0) {
    return { ok: false, error: "יש להוסיף לפחות אבן דרך אחת" };
  }

  const sumOfMilestones = milestones.reduce((s, m) => s + m.amount, 0);
  // Floating-point tolerance on equality check.
  if (Math.abs(sumOfMilestones - totalAmount) > 0.01) {
    return {
      ok: false,
      error: `סכום אבני הדרך (${sumOfMilestones.toFixed(2)}) לא שווה לסכום הכולל (${totalAmount.toFixed(2)})`
    };
  }

  return {
    ok: true,
    fields: {
      customerName,
      customerPhone,
      customerEmail,
      projectLocation,
      totalAmount,
      terms,
      quoteTitle,
      serviceDescription,
      pricesIncludeVat,
      milestones
    }
  };
}
