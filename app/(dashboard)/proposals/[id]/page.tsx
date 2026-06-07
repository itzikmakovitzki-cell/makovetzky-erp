import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Pencil,
  Send,
  XCircle
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_VARIANT
} from "@/lib/status-maps";
import { formatDate, formatDateTime, formatILS } from "@/lib/utils";
import { ShareButtons } from "@/components/proposals/share-buttons";
import { ConvertButton } from "@/components/proposals/convert-button";
import { DeleteProposalButton } from "@/components/proposals/delete-proposal-button";
import { ReopenProposalButton } from "@/components/proposals/reopen-proposal-button";
import type { ProposalMilestoneJson } from "@/app/actions/proposals";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null },
    include: {
      client: { select: { id: true, companyName: true } },
      masterDeal: { select: { id: true, name: true } },
      createdBy: { select: { name: true, email: true } }
    }
  });
  if (!proposal) notFound();

  const milestones = Array.isArray(proposal.milestones)
    ? (proposal.milestones as unknown as ProposalMilestoneJson[])
    : [];

  const isDraft = proposal.status === "DRAFT";
  const isSent = proposal.status === "SENT";
  const isSigned = proposal.status === "SIGNED";
  const isRejected = proposal.status === "REJECTED";
  const converted = !!proposal.convertedAt;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <Link
          href="/proposals"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-3" />
          חזרה להצעות מחיר
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4" />
              {proposal.customerName}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              <span>טלפון: <span className="text-foreground tabular-nums">{proposal.customerPhone}</span></span>
              {proposal.customerEmail && (
                <span>· אימייל: <span className="text-foreground">{proposal.customerEmail}</span></span>
              )}
              {proposal.projectLocation && (
                <span>· מיקום: <span className="text-foreground">{proposal.projectLocation}</span></span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </Badge>
            {!converted && (
              <DeleteProposalButton
                proposalId={proposal.id}
                customerName={proposal.customerName}
                redirectTo="/proposals"
              />
            )}
          </div>
        </div>
      </header>

      {converted && proposal.client && proposal.masterDeal && (
        <div className="rounded border border-emerald-500/40 bg-emerald-50/60 px-3 py-2 text-[12px] text-emerald-900 dark:bg-emerald-500/5 dark:text-emerald-200">
          <CheckCircle2 className="me-1 inline-block size-3 align-text-bottom" />
          ההצעה הומרה לפרויקט פעיל בתאריך {formatDate(proposal.convertedAt)}.{" "}
          <Link
            href={`/clients/${proposal.client.id}`}
            className="underline-offset-2 hover:underline"
          >
            עבור ללקוח {proposal.client.companyName}
          </Link>
        </div>
      )}

      {/* Share + actions */}
      {!isRejected && !converted && (
        <div className="rounded-md border bg-card p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {isSigned ? "פעולות" : "שיתוף ההצעה"}
            </div>
            {isDraft && (
              <Link
                href={`/proposals/${proposal.id}/edit`}
                className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
              >
                <Pencil className="size-2.5" />
                ערוך
              </Link>
            )}
            {isSent && (
              <ReopenProposalButton
                proposalId={proposal.id}
                customerName={proposal.customerName}
              />
            )}
          </div>
          {isSigned ? (
            <ConvertButton proposalId={proposal.id} />
          ) : (
            <ShareButtons
              proposalId={proposal.id}
              proposalStatus={proposal.status}
              customerName={proposal.customerName}
              customerPhone={proposal.customerPhone}
              customerEmail={proposal.customerEmail}
            />
          )}
          {(isDraft || isSent) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {proposal.templateVersion >= 2 && (
                <a
                  href={`/quote/${proposal.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
                >
                  <FileText className="size-2.5" />
                  תצוגה מקדימה כפי שהלקוח יראה
                </a>
              )}
              <p className="text-[10px] text-muted-foreground">
                קישור חתימה: <code className="rounded bg-muted px-1 py-0.5 text-[10px]">/quote/{proposal.id}</code>
              </p>
            </div>
          )}
          {/* V2 lifecycle stamps — visible to admin so they know what state
              the quote is in, when reminders went out, etc. */}
          {proposal.templateVersion >= 2 && (isSent || isDraft) && (
            <div className="mt-3 grid grid-cols-1 gap-1 border-t pt-2 text-[10px] text-muted-foreground sm:grid-cols-2">
              {proposal.sentAt && (
                <div className="inline-flex items-center gap-1">
                  <Send className="size-2.5" />
                  נשלחה ב-{formatDateTime(proposal.sentAt)}
                </div>
              )}
              {proposal.expiresAt && (
                <div className="inline-flex items-center gap-1">
                  <Clock className="size-2.5" />
                  תקפה עד {formatDateTime(proposal.expiresAt)}
                </div>
              )}
              {proposal.reminderSentAt && (
                <div className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <Bell className="size-2.5" />
                  תזכורת ללקוח נשלחה ב-{formatDateTime(proposal.reminderSentAt)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isRejected && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-800 dark:text-red-200">
          <XCircle className="me-1 inline-block size-3 align-text-bottom" />
          ההצעה נדחתה.
          {proposal.rejectionReason && (
            <span> סיבה: <em>{proposal.rejectionReason}</em></span>
          )}
        </div>
      )}

      {/* Total + milestones table */}
      <div className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תנאים מסחריים
          </h2>
          <div className="text-[12px]">
            סכום כולל:{" "}
            <span className="font-semibold tabular-nums">
              {formatILS(proposal.totalAmount)}
            </span>
            <span className="ms-1 text-[10px] text-muted-foreground">
              ({proposal.pricesIncludeVat ? "כולל מע״מ" : "לפני מע״מ"})
            </span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th className="w-12 text-center">#</th>
              <th>תיאור</th>
              <th className="w-32 text-end">סכום</th>
              <th className="w-32">תאריך יעד</th>
            </tr>
          </thead>
          <tbody>
            {milestones.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                  אין אבני דרך
                </td>
              </tr>
            )}
            {milestones.map((m, i) => (
              <tr key={i}>
                <td className="text-center text-[11px] tabular-nums">{i + 1}</td>
                <td className="text-[12px]">{m.description}</td>
                <td className="text-end text-[12px] tabular-nums">
                  {formatILS(m.amount)}
                </td>
                <td className="text-[11px] tabular-nums text-muted-foreground">
                  {m.dueDate ? formatDate(m.dueDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {proposal.terms && (
        <div className="rounded-md border bg-card">
          <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תנאים והערות
          </h2>
          <div className="whitespace-pre-wrap px-3 py-2 text-[12px]">
            {proposal.terms}
          </div>
        </div>
      )}

      {/* Signature evidence */}
      {isSigned && (
        <div className="rounded-md border bg-card">
          <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            פרטי החתימה
          </h2>
          <div className="space-y-2 px-3 py-3 text-[12px]">
            <div>
              <span className="text-muted-foreground">חתום ע"י:</span>{" "}
              <span className="font-medium">{proposal.signedName ?? "—"}</span>
            </div>
            {proposal.signedIdNumber && (
              <div>
                <span className="text-muted-foreground">ת.ז:</span>{" "}
                <span className="font-medium tabular-nums">
                  {proposal.signedIdNumber}
                </span>
              </div>
            )}
            {proposal.signedPhone && (
              <div>
                <span className="text-muted-foreground">טלפון בעת חתימה:</span>{" "}
                <span className="tabular-nums">{proposal.signedPhone}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">תאריך חתימה:</span>{" "}
              <span className="tabular-nums">{formatDate(proposal.signedAt)}</span>
            </div>
            {proposal.signedIp && (
              <div>
                <span className="text-muted-foreground">כתובת IP:</span>{" "}
                <span className="tabular-nums">{proposal.signedIp}</span>
              </div>
            )}
            {proposal.signedUserAgent && (
              <div>
                <span className="text-muted-foreground">דפדפן:</span>{" "}
                <span className="break-all text-[11px]">
                  {proposal.signedUserAgent}
                </span>
              </div>
            )}
            {proposal.signedPdfPath && (
              <div className="pt-1">
                <a
                  href={`/api/proposals/${proposal.id}/pdf?mode=signed`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded border border-emerald-600 bg-emerald-600 px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
                >
                  <Download className="size-3" />
                  הורד הצעה חתומה
                </a>
              </div>
            )}
            {proposal.signatureData && proposal.signatureData.startsWith("data:image/") && (
              <div>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  סריקת חתימה
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proposal.signatureData}
                  alt="חתימה"
                  className="max-h-32 rounded border border-input bg-white"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground">
        נוצרה ב-{formatDate(proposal.createdAt)} ע"י {proposal.createdBy?.name ?? "—"}
      </div>
    </section>
  );
}
