"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  AuthoritySubmissionStatus,
  Prisma,
  TaskStatus
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Block 26: per-(permit, category) authority submission lifecycle.
//
// MVP behaviour: when status moves to SUBMITTED, every category task currently
// in OPEN or IN_PROGRESS is bulk-flipped to AWAITING_AUTHORITY + frozen=true,
// so Bat-Or doesn't have to update each task by hand. Already-COMPLETED tasks
// are left untouched (they pre-date the submission). BLOCKED is also left
// alone — a blocked task isn't actually pending the authority's review.
//
// On other transitions (APPROVED / REJECTED / back to PREPARING) the action
// is metadata-only; the admin keeps explicit control of task statuses.

const VALID_NEXT: Record<AuthoritySubmissionStatus, AuthoritySubmissionStatus[]> = {
  PREPARING: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED", "PREPARING"],
  APPROVED: ["PREPARING"],
  REJECTED: ["SUBMITTED", "PREPARING"]
};

export type SubmissionTransitionResult =
  | { ok: true; submissionId: string; taskUpdates: number }
  | { ok: false; error: string };

export async function transitionAuthoritySubmission(formData: FormData): Promise<SubmissionTransitionResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const permitId = String(formData.get("permitId") || "");
    const category = String(formData.get("category") || "").trim();
    const nextStatus = String(formData.get("nextStatus") || "") as AuthoritySubmissionStatus;
    const decisionNotes = String(formData.get("decisionNotes") || "").trim() || null;

    if (!permitId || !category) {
      return { ok: false, error: "חסר היתר או קטגוריה" };
    }
    if (!(nextStatus in VALID_NEXT)) {
      return { ok: false, error: "סטטוס לא חוקי" };
    }

    const permit = await prisma.permit.findFirst({
      where: { id: permitId, deletedAt: null },
      select: { id: true }
    });
    if (!permit) {
      return { ok: false, error: "ההיתר לא נמצא" };
    }

    // Locate-or-create the submission row. The (permitId, category) pair is
    // unique so we don't risk concurrent duplicates.
    const existing = await prisma.authoritySubmission.findUnique({
      where: { permitId_category: { permitId, category } }
    });

    // Validate the requested transition. From "nothing yet" only PREPARING or
    // SUBMITTED make sense; we treat absence as PREPARING.
    const currentStatus = existing?.status ?? "PREPARING";
    if (!VALID_NEXT[currentStatus].includes(nextStatus) && currentStatus !== nextStatus) {
      return {
        ok: false,
        error: `לא ניתן לעבור מ-${currentStatus} ל-${nextStatus}`
      };
    }

    const now = new Date();
    const updateData: Prisma.AuthoritySubmissionUpdateInput = {
      status: nextStatus,
      decisionNotes
    };
    if (nextStatus === "SUBMITTED") {
      updateData.submittedAt = now;
      updateData.submittedBy = { connect: { id: me.id } };
      updateData.decidedAt = null;
    } else if (nextStatus === "APPROVED" || nextStatus === "REJECTED") {
      updateData.decidedAt = now;
    } else if (nextStatus === "PREPARING") {
      // Reset — clear submitted/decided timestamps but keep the row so the
      // audit trail of past transitions stays linkable.
      updateData.submittedAt = null;
      updateData.decidedAt = null;
    }

    let submissionId: string;
    let taskUpdates = 0;

    await prisma.$transaction(async (tx) => {
      const submission = existing
        ? await tx.authoritySubmission.update({
            where: { id: existing.id },
            data: updateData
          })
        : await tx.authoritySubmission.create({
            data: {
              permitId,
              category,
              status: nextStatus,
              decisionNotes,
              ...(nextStatus === "SUBMITTED"
                ? { submittedAt: now, submittedById: me.id }
                : {}),
              ...(nextStatus === "APPROVED" || nextStatus === "REJECTED"
                ? { decidedAt: now }
                : {})
            }
          });
      submissionId = submission.id;

      // Side-effects on submission transitions, kept symmetric so the
      // category-task state never drifts from the visible pill:
      //
      //   PREPARING → SUBMITTED  : push OPEN/IN_PROGRESS tasks into
      //                            AWAITING_AUTHORITY + frozen=true
      //
      //   * → PREPARING          : ROLLBACK. The admin clicked "back to
      //     (regardless of where      collecting" which means "we're not
      //      we came from)            waiting on the authority anymore"
      //                            — unfreeze every AWAITING_AUTHORITY task
      //                              in the category, back to OPEN. COMPLETED
      //                              tasks left untouched.
      //
      //   * → REJECTED           : the authority sent us back with comments.
      //                            Tasks need to be workable again so the
      //                            team can fix and resubmit — same unfreeze.
      //
      //   * → APPROVED           : tasks stay frozen until the admin marks
      //                            each COMPLETED explicitly (deliberate —
      //                            "approved" doesn't auto-close per-task
      //                            workitems).
      if (nextStatus === "SUBMITTED") {
        const updated = await tx.task.updateMany({
          where: {
            permitId,
            category,
            deletedAt: null,
            status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] }
          },
          data: {
            status: TaskStatus.AWAITING_AUTHORITY,
            frozen: true
          }
        });
        taskUpdates = updated.count;
      } else if (nextStatus === "PREPARING" || nextStatus === "REJECTED") {
        const updated = await tx.task.updateMany({
          where: {
            permitId,
            category,
            deletedAt: null,
            status: TaskStatus.AWAITING_AUTHORITY
          },
          data: {
            status: TaskStatus.OPEN,
            frozen: false
          }
        });
        taskUpdates = updated.count;
      }

      await logAudit(tx, {
        entityType: AuditEntity.AUTHORITY_SUBMISSION,
        entityId: submission.id,
        action: AuditAction.STATUS_CHANGE,
        oldValue: existing
          ? { status: existing.status, decisionNotes: existing.decisionNotes }
          : { status: "PREPARING (implicit — first transition)" },
        newValue: {
          status: nextStatus,
          decisionNotes,
          permitId,
          category,
          taskUpdates
        },
        userId: me.id
      });
    });

    revalidatePath(`/permits/${permitId}`, "layout");
    revalidatePath("/tasks");

    return { ok: true, submissionId: submissionId!, taskUpdates };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "שגיאה במעבר סטטוס"
    };
  }
}
