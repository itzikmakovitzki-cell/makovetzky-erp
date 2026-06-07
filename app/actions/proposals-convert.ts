"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";
import { parseMilestonesPayload } from "@/lib/proposals/parsing";

// Conversion (admin only) — materializes a signed proposal into a real
// Client + MasterDeal + DealMilestones triple. One transaction; partial
// conversion is impossible. Idempotent: re-running after a successful
// conversion is rejected (the convertedAt timestamp on the proposal is the
// guard).
//
// Split out from app/actions/proposals.ts (June 2026). This is the heart of
// Block 15 — significantly complex and worth a dedicated file for reviewers.

type ActionResult<T = void> = { ok: boolean; error: string | null; data?: T };

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
