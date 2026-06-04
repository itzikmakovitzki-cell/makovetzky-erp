"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AuditAction, Prisma, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { validateIsraeliId, normalizeIsraeliId } from "@/lib/israeli-id";
import {
  buildProposalHtml,
  renderPdfBuffer,
  type ProposalMilestoneLite
} from "@/lib/proposal-pdf";
import {
  buildProposalStoragePath,
  uploadToStorage
} from "@/lib/supabase-storage";

type ActionResult<T = void> = { ok: boolean; error: string | null; data?: T };
type FormState = { ok: boolean; error: string | null; id?: string };

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

function parseMilestonesPayload(raw: unknown): ProposalMilestoneJson[] {
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

function parseAmount(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return NaN;
  return Math.round(n * 100) / 100;
}

// ============================================================================
// CREATE / UPDATE (admin only)
// ============================================================================

export async function createProposal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);

    const customerName = String(formData.get("customerName") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const customerEmail =
      String(formData.get("customerEmail") || "").trim() || null;
    const projectLocation =
      String(formData.get("projectLocation") || "").trim() || null;
    const totalAmount = parseAmount(formData.get("totalAmount"));
    const terms = String(formData.get("terms") || "").trim() || null;
    const quoteTitle =
      String(formData.get("quoteTitle") || "").trim() || null;
    const serviceDescription =
      String(formData.get("serviceDescription") || "").trim() || null;

    if (!customerName) return { ok: false, error: "שם הלקוח חובה" };
    if (!customerPhone) return { ok: false, error: "טלפון הלקוח חובה" };
    if (Number.isNaN(totalAmount)) {
      return { ok: false, error: "סכום כולל לא חוקי" };
    }

    const milestonesRaw = String(formData.get("milestones") || "[]");
    let milestonesJson: ProposalMilestoneJson[];
    try {
      milestonesJson = parseMilestonesPayload(JSON.parse(milestonesRaw));
    } catch {
      return { ok: false, error: "פורמט אבני הדרך לא חוקי" };
    }
    if (milestonesJson.length === 0) {
      return { ok: false, error: "יש להוסיף לפחות אבן דרך אחת" };
    }

    const sumOfMilestones = milestonesJson.reduce(
      (s, m) => s + m.amount,
      0
    );
    // Floating-point tolerance on equality check.
    if (Math.abs(sumOfMilestones - totalAmount) > 0.01) {
      return {
        ok: false,
        error: `סכום אבני הדרך (${sumOfMilestones.toFixed(2)}) לא שווה לסכום הכולל (${totalAmount.toFixed(2)})`
      };
    }

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          customerName,
          customerPhone,
          customerEmail,
          projectLocation,
          totalAmount,
          milestones: milestonesJson as unknown as Prisma.InputJsonValue,
          terms,
          quoteTitle,
          serviceDescription,
          // All new proposals are V2 (branded PDF flow). Existing V1 rows on
          // the same table keep their old templateVersion=1 and old renderer.
          templateVersion: 2,
          status: ProposalStatus.DRAFT,
          createdById: me.id
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: created.id,
        action: AuditAction.CREATE,
        newValue: {
          customerName,
          customerPhone,
          totalAmount,
          milestoneCount: milestonesJson.length
        },
        userId: me.id
      });
      return created;
    });

    revalidatePath("/proposals");
    return { ok: true, error: null, id: proposal.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

export async function updateProposal(
  proposalId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const existing = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: {
        id: true,
        status: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        projectLocation: true,
        totalAmount: true,
        terms: true,
        milestones: true
      }
    });
    if (!existing) return { ok: false, error: "הצעת המחיר לא נמצאה" };
    // Only DRAFT proposals are editable. SENT/SIGNED/REJECTED are immutable
    // so the customer-facing copy can't change after a share link went out.
    if (existing.status !== ProposalStatus.DRAFT) {
      return { ok: false, error: "ניתן לערוך רק טיוטות" };
    }

    const customerName = String(formData.get("customerName") || "").trim();
    const customerPhone = String(formData.get("customerPhone") || "").trim();
    const customerEmail =
      String(formData.get("customerEmail") || "").trim() || null;
    const projectLocation =
      String(formData.get("projectLocation") || "").trim() || null;
    const totalAmount = parseAmount(formData.get("totalAmount"));
    const terms = String(formData.get("terms") || "").trim() || null;
    const quoteTitle =
      String(formData.get("quoteTitle") || "").trim() || null;
    const serviceDescription =
      String(formData.get("serviceDescription") || "").trim() || null;

    if (!customerName) return { ok: false, error: "שם הלקוח חובה" };
    if (!customerPhone) return { ok: false, error: "טלפון הלקוח חובה" };
    if (Number.isNaN(totalAmount)) {
      return { ok: false, error: "סכום כולל לא חוקי" };
    }

    const milestonesRaw = String(formData.get("milestones") || "[]");
    let milestonesJson: ProposalMilestoneJson[];
    try {
      milestonesJson = parseMilestonesPayload(JSON.parse(milestonesRaw));
    } catch {
      return { ok: false, error: "פורמט אבני הדרך לא חוקי" };
    }
    if (milestonesJson.length === 0) {
      return { ok: false, error: "יש להוסיף לפחות אבן דרך אחת" };
    }
    const sumOfMilestones = milestonesJson.reduce((s, m) => s + m.amount, 0);
    if (Math.abs(sumOfMilestones - totalAmount) > 0.01) {
      return {
        ok: false,
        error: `סכום אבני הדרך (${sumOfMilestones.toFixed(2)}) לא שווה לסכום הכולל (${totalAmount.toFixed(2)})`
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          customerName,
          customerPhone,
          customerEmail,
          projectLocation,
          totalAmount,
          milestones: milestonesJson as unknown as Prisma.InputJsonValue,
          terms,
          quoteTitle,
          serviceDescription
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.UPDATE,
        oldValue: {
          customerName: existing.customerName,
          totalAmount: Number(existing.totalAmount)
        },
        newValue: { customerName, totalAmount },
        userId: me.id
      });
    });

    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ============================================================================
// SHARE / STATUS TRANSITIONS
// ============================================================================

// Idempotent transition. Admin invokes this from the share buttons; we lift
// DRAFT → SENT so the customer-facing audit trail is meaningful.
export async function markProposalSent(
  proposalId: string
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (proposal.status !== ProposalStatus.DRAFT) {
      return { ok: true, error: null }; // already sent / signed — no-op
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: { status: ProposalStatus.SENT }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: ProposalStatus.DRAFT },
        newValue: { status: ProposalStatus.SENT },
        userId: me.id
      });
    });

    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ============================================================================
// PUBLIC SIGN / REJECT (no auth — cuid id is the secret)
// ============================================================================

// Public action callable from /quote/[id]. No auth gate. Treats the cuid id
// as a sufficiently-unguessable token.
//
// V1 path (templateVersion = 1, legacy rows): records typed name + optional
// canvas dataURL onto `signatureData` / `signedName`, like before.
//
// V2 path (templateVersion >= 2, new flow): requires Israeli ID number too,
// captures IP/UA + the customer's phone at signing time, renders the signed
// PDF, and uploads it to Supabase storage. The PDF becomes the document of
// record for the agreement.
export async function signProposal(
  proposalId: string,
  input: {
    signedName: string;
    signedIdNumber?: string | null;
    signatureData?: string | null;
  }
): Promise<ActionResult> {
  try {
    if (!proposalId) return { ok: false, error: "מזהה הצעה חסר" };
    const signedName = String(input.signedName || "").trim();
    if (!signedName) {
      return { ok: false, error: "יש להזין שם מלא לחתימה" };
    }
    const signatureData =
      input.signatureData && String(input.signatureData).trim()
        ? String(input.signatureData)
        : null;

    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (proposal.status === ProposalStatus.SIGNED) {
      return { ok: false, error: "ההצעה כבר נחתמה" };
    }
    if (proposal.status === ProposalStatus.REJECTED) {
      return { ok: false, error: "ההצעה נדחתה ולא ניתן לחתום עליה" };
    }

    const now = new Date();

    // === V1: legacy signing — unchanged behavior ===
    if (proposal.templateVersion < 2) {
      await prisma.$transaction(async (tx) => {
        await tx.proposal.update({
          where: { id: proposalId },
          data: {
            status: ProposalStatus.SIGNED,
            signedName,
            signatureData,
            signedAt: now
          }
        });
        await logAudit(tx, {
          entityType: AuditEntity.PROPOSAL,
          entityId: proposalId,
          action: AuditAction.APPROVE,
          oldValue: { status: proposal.status },
          newValue: {
            status: ProposalStatus.SIGNED,
            signedName,
            signedAt: now.toISOString()
          },
          userId: null
        });
      });

      revalidatePath(`/quote/${proposalId}`);
      revalidatePath(`/proposals/${proposalId}`);
      revalidatePath("/proposals");
      return { ok: true, error: null };
    }

    // === V2: branded PDF + richer audit ===
    const signedIdNumber = normalizeIsraeliId(input.signedIdNumber);
    if (!signedIdNumber) {
      return { ok: false, error: "יש להזין מספר תעודת זהות" };
    }
    if (!validateIsraeliId(signedIdNumber)) {
      return { ok: false, error: "מספר תעודת הזהות אינו תקין" };
    }
    if (!signatureData) {
      return { ok: false, error: "יש לחתום בריבוע החתימה" };
    }

    // Capture audit metadata from request headers. headers() is async in Next 15.
    const h = await headers();
    const xff = h.get("x-forwarded-for") || "";
    const signedIp = (xff.split(",")[0] || h.get("x-real-ip") || "").trim() || null;
    const signedUserAgent = h.get("user-agent") || null;

    const milestones: ProposalMilestoneLite[] = Array.isArray(
      proposal.milestones
    )
      ? (proposal.milestones as unknown as ProposalMilestoneLite[])
      : [];

    // Render the signed PDF, then upload BEFORE the DB update so a storage
    // failure aborts the whole sign — never want a SIGNED row without a PDF.
    const html = buildProposalHtml(
      {
        id: proposal.id,
        quoteTitle: proposal.quoteTitle,
        customerName: proposal.customerName,
        customerPhone: proposal.customerPhone,
        customerEmail: proposal.customerEmail,
        projectLocation: proposal.projectLocation,
        totalAmount: proposal.totalAmount.toString(),
        serviceDescription: proposal.serviceDescription,
        milestones,
        createdAt: proposal.createdAt
      },
      {
        mode: "signed",
        signature: {
          signedName,
          signedIdNumber,
          signatureDataUrl: signatureData,
          signedAt: now
        }
      }
    );
    const pdfBuffer = await renderPdfBuffer(html);
    const path = buildProposalStoragePath(proposal.id, "signed");
    await uploadToStorage(pdfBuffer, path, "application/pdf");

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.SIGNED,
          signedName,
          signedIdNumber,
          signedPhone: proposal.customerPhone,
          signedIp,
          signedUserAgent,
          signedPdfPath: path,
          // Keep the raw canvas dataURL too — cheap belt-and-suspenders if we
          // ever need to re-render the signed PDF from source.
          signatureData,
          signedAt: now
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.APPROVE,
        oldValue: { status: proposal.status },
        newValue: {
          status: ProposalStatus.SIGNED,
          signedName,
          signedIdNumber,
          signedPhone: proposal.customerPhone,
          signedIp,
          signedPdfPath: path,
          signedAt: now.toISOString()
        },
        userId: null
      });
    });

    revalidatePath(`/quote/${proposalId}`);
    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

export async function rejectProposal(
  proposalId: string,
  rejectionReason: string
): Promise<ActionResult> {
  try {
    const reason = String(rejectionReason || "").trim();
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: { id: true, status: true }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (
      proposal.status !== ProposalStatus.SENT &&
      proposal.status !== ProposalStatus.DRAFT
    ) {
      return { ok: false, error: "לא ניתן לדחות הצעה במצב זה" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.REJECTED,
          rejectionReason: reason || null
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.REJECT,
        oldValue: { status: proposal.status },
        newValue: { status: ProposalStatus.REJECTED, rejectionReason: reason },
        userId: null
      });
    });

    revalidatePath(`/quote/${proposalId}`);
    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ============================================================================
// CONVERSION (admin only) — the heart of Block 15
// ============================================================================

// Materializes a signed proposal into Client + MasterDeal + DealMilestones.
// One transaction; partial conversion is not possible. Idempotent: re-running
// after a successful conversion is rejected (convertedAt is set).
export async function convertProposalToProject(
  proposalId: string
): Promise<ActionResult<{ masterDealId: string; clientId: string }>> {
  try {
    const me = await requireRole(["ADMIN"]);
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: {
        id: true,
        status: true,
        convertedAt: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        projectLocation: true,
        totalAmount: true,
        milestones: true,
        terms: true,
        signedName: true,
        signedAt: true,
        clientId: true,
        masterDealId: true
      }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (proposal.status !== ProposalStatus.SIGNED) {
      return { ok: false, error: "ניתן להמיר רק הצעה חתומה" };
    }
    if (proposal.convertedAt) {
      return { ok: false, error: "ההצעה כבר הומרה לפרויקט" };
    }

    const milestonesJson = parseMilestonesPayload(proposal.milestones);
    if (milestonesJson.length === 0) {
      return { ok: false, error: "אין אבני דרך להמרה" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Client — companyName=customerName (B2C-on-B2B-schema concession;
      //    project doesn't have a separate person model). contactName mirrors
      //    customerName since the proposal flow is direct-to-customer.
      const client = await tx.client.create({
        data: {
          companyName: proposal.customerName,
          contactName: proposal.customerName,
          phone: proposal.customerPhone,
          email: proposal.customerEmail,
          address: proposal.projectLocation,
          notes: proposal.terms
            ? `נוצר מהצעת מחיר ${proposal.id}\n\nתנאים:\n${proposal.terms}`
            : `נוצר מהצעת מחיר ${proposal.id}`
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.CLIENT,
        entityId: client.id,
        action: AuditAction.CREATE,
        newValue: {
          source: "proposal_conversion",
          proposalId: proposal.id,
          companyName: client.companyName,
          phone: client.phone
        },
        userId: me.id
      });

      // 2. MasterDeal — name comes from the proposal location or a default.
      const dealName = proposal.projectLocation
        ? `פרויקט ${proposal.projectLocation}`
        : `פרויקט ${proposal.customerName}`;
      const deal = await tx.masterDeal.create({
        data: {
          clientId: client.id,
          name: dealName,
          totalValue: proposal.totalAmount,
          status: "ACTIVE",
          contractDate: proposal.signedAt ?? new Date(),
          notes: `נוצר מהצעת מחיר ${proposal.id} שנחתמה על ידי ${proposal.signedName ?? "—"}`
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.MASTER_DEAL,
        entityId: deal.id,
        action: AuditAction.CREATE,
        newValue: {
          source: "proposal_conversion",
          proposalId: proposal.id,
          clientId: client.id,
          dealName,
          totalValue: Number(proposal.totalAmount)
        },
        userId: me.id
      });

      // 3. DealMilestones — materialize the JSON list into real rows.
      // triggerPercentage (when set on the proposal milestone) is carried
      // over so the finances tab can show its progress against project tasks.
      const milestoneRows = milestonesJson.map((m, idx) => ({
        masterDealId: deal.id,
        description: m.description,
        amount: m.amount,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
        orderIndex: idx,
        triggerPercentage: m.triggerPercentage ?? null
      }));
      await tx.dealMilestone.createMany({ data: milestoneRows });
      await logAudit(tx, {
        entityType: AuditEntity.DEAL_MILESTONE,
        entityId: deal.id,
        action: AuditAction.CREATE,
        newValue: {
          source: "proposal_conversion",
          proposalId: proposal.id,
          count: milestoneRows.length,
          total: milestoneRows.reduce((s, m) => s + Number(m.amount), 0)
        },
        userId: me.id
      });

      // 4. Link the proposal back to the new client + deal. The signed
      //    snapshot stays on the Proposal record as the source of truth
      //    for the agreement.
      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          clientId: client.id,
          masterDealId: deal.id,
          convertedAt: new Date()
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposal.id,
        action: AuditAction.UPDATE,
        oldValue: { convertedAt: null },
        newValue: {
          event: "converted_to_project",
          clientId: client.id,
          masterDealId: deal.id,
          convertedAt: new Date().toISOString()
        },
        userId: me.id
      });

      return { clientId: client.id, masterDealId: deal.id };
    });

    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath("/proposals");
    revalidatePath("/clients");
    revalidatePath(`/clients/${result.clientId}`);
    return { ok: true, error: null, data: result };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}

// ============================================================================
// SOFT DELETE
// ============================================================================

export async function deleteProposal(
  proposalId: string
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: { id: true, status: true, convertedAt: true, customerName: true }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (proposal.convertedAt) {
      return {
        ok: false,
        error: "לא ניתן למחוק הצעה שכבר הומרה לפרויקט"
      };
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: { deletedAt: now }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.DELETE,
        oldValue: { customerName: proposal.customerName, status: proposal.status },
        newValue: { softDeletedAt: now.toISOString() },
        userId: me.id
      });
    });

    revalidatePath("/proposals");
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה לא צפויה"
    };
  }
}
