"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { AuditAction, ProposalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
import {
  isGreenApiConfigured,
  sendWhatsAppMessage
} from "@/lib/green-api";
import { formatDateTime, formatILS } from "@/lib/utils";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

// Public-facing proposal actions — callable from /quote/[id] WITHOUT a
// logged-in session. The cuid in the URL is treated as a sufficiently-
// unguessable token. Everything in this file MUST tolerate `userId: null`
// in audit rows since there's no authenticated actor.
//
// Split out from app/actions/proposals.ts (June 2026) to separate the
// no-auth surface from the admin-only CRUD/share/convert/delete flows
// next door — different security model, different review profile.

type ActionResult<T = void> = { ok: boolean; error: string | null; data?: T };

// Public action callable from /quote/[id]. No auth gate.
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

    const ip = getRequestIp(await headers());
    const rl = checkRateLimit(`sign-proposal:${ip}:${proposalId}`, {
      limit: 8,
      windowMs: 5 * 60 * 1000
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: `יותר מדי ניסיונות. נסה שוב בעוד ${rl.retryAfterSeconds} שניות`
      };
    }

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
      const signed = await prisma.$transaction(async (tx) => {
        // Conditional update guards against a concurrent sign/reject request
        // racing this one — only one submit can win the SIGNED transition.
        const { count } = await tx.proposal.updateMany({
          where: {
            id: proposalId,
            status: { notIn: [ProposalStatus.SIGNED, ProposalStatus.REJECTED] }
          },
          data: {
            status: ProposalStatus.SIGNED,
            signedName,
            signatureData,
            signedAt: now
          }
        });
        if (count === 0) return false;
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
        return true;
      });

      if (!signed) return { ok: false, error: "ההצעה כבר נחתמה או נדחתה" };

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

    // Render the signed HTML, then try to convert to PDF. The PDF is always
    // the preferred format, but if the puppeteer/chromium runtime fails (a
    // recurring pain on Vercel — libnss3.so etc.), fall back to storing the
    // HTML snapshot with the signature embedded. Either format is a complete,
    // legally-meaningful record — the audit data (name, ID, IP, UA, phone,
    // timestamp) is what matters and lives on the DB row regardless.
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
        pricesIncludeVat: proposal.pricesIncludeVat,
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
    let path: string;
    try {
      const pdfBuffer = await renderPdfBuffer(html);
      path = buildProposalStoragePath(proposal.id, "signed");
      await uploadToStorage(pdfBuffer, path, "application/pdf");
    } catch (renderErr) {
      // PDF rendering failed — keep the signing flow alive by saving the HTML
      // snapshot instead. The download endpoint detects extension and serves
      // the right content-type.
      console.warn(
        "[signProposal] PDF render failed, saving HTML snapshot instead:",
        renderErr instanceof Error ? renderErr.message : renderErr
      );
      const htmlPath = buildProposalStoragePath(proposal.id, "signed").replace(
        /\.pdf$/,
        ".html"
      );
      await uploadToStorage(
        new TextEncoder().encode(html),
        htmlPath,
        "text/html; charset=utf-8"
      );
      path = htmlPath;
    }

    const signed = await prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent sign/reject request
      // racing this one (e.g. double-submit) — only one can win the transition.
      const { count } = await tx.proposal.updateMany({
        where: {
          id: proposalId,
          status: { notIn: [ProposalStatus.SIGNED, ProposalStatus.REJECTED] }
        },
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
      if (count === 0) return false;
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
      return true;
    });

    if (!signed) return { ok: false, error: "ההצעה כבר נחתמה או נדחתה" };

    // Fire-and-forget admin notifications (don't fail the sign on a Green API
    // hiccup — the signature itself is already persisted). Errors get logged
    // but never bubble up.
    notifyAdminsOfSignature(proposalId).catch((err) => {
      console.warn("[signProposal] admin notification failed:", err);
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

// Internal helper — sends a WhatsApp message to every admin user with a
// phone on file announcing a customer signature. Best-effort, no return.
async function notifyAdminsOfSignature(proposalId: string): Promise<void> {
  if (!isGreenApiConfigured()) return;
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      projectLocation: true,
      totalAmount: true,
      pricesIncludeVat: true,
      signedName: true,
      signedAt: true,
      adminNotifiedAt: true
    }
  });
  if (!proposal || proposal.adminNotifiedAt) return;

  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
      phone: { not: null }
    },
    select: { id: true, phone: true }
  });
  if (admins.length === 0) return;

  const total = formatILS(proposal.totalAmount);
  const vatNote = proposal.pricesIncludeVat ? "כולל מע״מ" : "לפני מע״מ";
  const locationLine = proposal.projectLocation
    ? `מיקום: ${proposal.projectLocation}\n`
    : "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = baseUrl ? `${baseUrl}/proposals/${proposal.id}` : "";
  const message =
    `🎉 הצעת מחיר נחתמה!\n\n` +
    `לקוח: ${proposal.customerName}\n` +
    `${locationLine}` +
    `סכום: ${total} (${vatNote})\n` +
    `חתם: ${proposal.signedName ?? "—"}\n` +
    `מועד: ${formatDateTime(proposal.signedAt)}\n` +
    (link ? `\n${link}` : "");

  await Promise.allSettled(
    admins.map((a) =>
      a.phone ? sendWhatsAppMessage({ phone: a.phone, message }) : Promise.resolve()
    )
  );

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { adminNotifiedAt: new Date() }
  });
}

// Public action callable from /quote/[id]. No auth gate. Customer-facing
// rejection — captures the reason for the audit trail.
export async function rejectProposal(
  proposalId: string,
  rejectionReason: string
): Promise<ActionResult> {
  try {
    if (!proposalId) return { ok: false, error: "מזהה הצעה חסר" };

    const ip = getRequestIp(await headers());
    const rl = checkRateLimit(`reject-proposal:${ip}:${proposalId}`, {
      limit: 8,
      windowMs: 5 * 60 * 1000
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: `יותר מדי ניסיונות. נסה שוב בעוד ${rl.retryAfterSeconds} שניות`
      };
    }

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

    const rejected = await prisma.$transaction(async (tx) => {
      // Conditional update guards against a concurrent sign/reject request
      // racing this one — only one submit can win the REJECTED transition.
      const { count } = await tx.proposal.updateMany({
        where: {
          id: proposalId,
          status: { in: [ProposalStatus.SENT, ProposalStatus.DRAFT] }
        },
        data: {
          status: ProposalStatus.REJECTED,
          rejectionReason: reason || null
        }
      });
      if (count === 0) return false;
      await logAudit(tx, {
        entityType: AuditEntity.PROPOSAL,
        entityId: proposalId,
        action: AuditAction.REJECT,
        oldValue: { status: proposal.status },
        newValue: { status: ProposalStatus.REJECTED, rejectionReason: reason },
        userId: null
      });
      return true;
    });

    if (!rejected) return { ok: false, error: "לא ניתן לדחות הצעה במצב זה" };

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
