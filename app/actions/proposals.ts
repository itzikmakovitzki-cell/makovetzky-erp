"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, Prisma, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { parseProposalFormFields } from "@/lib/proposals/parsing";

// Admin-only Proposal actions — create / update / share / delete. Split out
// of the original 878-line proposals.ts file (June 2026):
//   - sign + reject moved to ./proposals-public.ts (no-auth surface)
//   - convertProposalToProject moved to ./proposals-convert.ts (Block 15's
//     heart, complex transaction worth a dedicated file)
//   - parseAmount + parseMilestonesPayload + ProposalMilestoneJson moved
//     to lib/proposals/parsing.ts so all three action files share them
//     without dragging in "use server" from each other.
//
// The public ProposalMilestoneJson type continues to be re-exported here
// for back-compat with consumers that already imported it from this file.

// V2 quote validity window — used by markProposalSent to stamp expiresAt and
// by the public page to lock signing once exceeded.
const PROPOSAL_VALIDITY_DAYS = 14;

type ActionResult<T = void> = { ok: boolean; error: string | null; data?: T };
type FormState = { ok: boolean; error: string | null; id?: string };

// Back-compat re-export so existing consumer imports continue to work.
// Prefer importing from "@/lib/proposals/parsing" in new code.
export type { ProposalMilestoneJson } from "@/lib/proposals/parsing";

// ============================================================================
// CREATE / UPDATE (admin only)
// ============================================================================

export async function createProposal(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const me = await requireRole(["ADMIN"]);

    const parsed = parseProposalFormFields(formData);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const f = parsed.fields;

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          customerEmail: f.customerEmail,
          projectLocation: f.projectLocation,
          totalAmount: f.totalAmount,
          milestones: f.milestones as unknown as Prisma.InputJsonValue,
          terms: f.terms,
          quoteTitle: f.quoteTitle,
          serviceDescription: f.serviceDescription,
          pricesIncludeVat: f.pricesIncludeVat,
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
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          totalAmount: f.totalAmount,
          milestoneCount: f.milestones.length
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

    const parsed = parseProposalFormFields(formData);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const f = parsed.fields;

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          customerEmail: f.customerEmail,
          projectLocation: f.projectLocation,
          totalAmount: f.totalAmount,
          milestones: f.milestones as unknown as Prisma.InputJsonValue,
          terms: f.terms,
          quoteTitle: f.quoteTitle,
          serviceDescription: f.serviceDescription,
          pricesIncludeVat: f.pricesIncludeVat
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.UPDATE,
        oldValue: {
          customerName: existing.customerName,
          customerPhone: existing.customerPhone,
          customerEmail: existing.customerEmail,
          projectLocation: existing.projectLocation,
          totalAmount: Number(existing.totalAmount),
          terms: existing.terms,
          milestoneCount: Array.isArray(existing.milestones)
            ? existing.milestones.length
            : 0
        },
        newValue: {
          customerName: f.customerName,
          customerPhone: f.customerPhone,
          customerEmail: f.customerEmail,
          projectLocation: f.projectLocation,
          totalAmount: f.totalAmount,
          terms: f.terms,
          milestoneCount: f.milestones.length
        },
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

    const sentAt = new Date();
    const expiresAt = new Date(
      sentAt.getTime() + PROPOSAL_VALIDITY_DAYS * 24 * 60 * 60 * 1000
    );
    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.SENT,
          sentAt,
          expiresAt
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.STATUS_CHANGE,
        oldValue: { status: ProposalStatus.DRAFT },
        newValue: {
          status: ProposalStatus.SENT,
          sentAt: sentAt.toISOString(),
          expiresAt: expiresAt.toISOString()
        },
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

// Reverse transition: SENT → DRAFT so the admin can edit a proposal that's
// already out the door (customer asked for a revision, typo found, milestone
// schedule needs tweaking). Without this, the only path was to delete the
// proposal and rebuild it from scratch — losing the cuid / share-link and
// breaking any conversation the admin had with the customer over the link.
//
// SIGNED is intentionally NOT reversible here — once the customer has put
// their signature on a document, reopening it for edits silently would
// invalidate the legal record. If the admin really needs to amend a signed
// proposal they should create a fresh one.
//
// Clears sentAt / expiresAt / reminderSentAt / adminNotifiedAt so the V2
// lifecycle stamps reset cleanly; a future markProposalSent will compute
// fresh values.
export async function reopenProposalForEdit(
  proposalId: string
): Promise<ActionResult> {
  try {
    const me = await requireRole(["ADMIN"]);
    const proposal = await prisma.proposal.findFirst({
      where: { id: proposalId, deletedAt: null },
      select: {
        id: true,
        status: true,
        customerName: true,
        sentAt: true,
        expiresAt: true,
        reminderSentAt: true,
        adminNotifiedAt: true
      }
    });
    if (!proposal) return { ok: false, error: "הצעה לא נמצאה" };
    if (proposal.status === ProposalStatus.DRAFT) {
      return { ok: true, error: null }; // already draft — no-op
    }
    if (proposal.status === ProposalStatus.SIGNED) {
      return {
        ok: false,
        error:
          "ההצעה נחתמה — אי-אפשר לפתוח אותה מחדש. צור הצעה חדשה במקום."
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: {
          status: ProposalStatus.DRAFT,
          sentAt: null,
          expiresAt: null,
          reminderSentAt: null,
          adminNotifiedAt: null,
          // Clear any rejection trace too if this came back from REJECTED.
          rejectionReason: null
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.STATUS_CHANGE,
        oldValue: {
          status: proposal.status,
          sentAt: proposal.sentAt?.toISOString() ?? null,
          expiresAt: proposal.expiresAt?.toISOString() ?? null
        },
        newValue: {
          status: ProposalStatus.DRAFT,
          customerName: proposal.customerName,
          event: "reopened_for_edit"
        },
        userId: me.id
      });
    });

    revalidatePath(`/proposals/${proposalId}`);
    revalidatePath(`/proposals/${proposalId}/edit`);
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
