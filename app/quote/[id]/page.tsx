import Image from "next/image";
import { AlertTriangle, CheckCircle2, Download, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_VARIANT
} from "@/lib/status-maps";
import { formatDate, formatDateTime, formatILS } from "@/lib/utils";
import { SignAndReject } from "@/components/proposals/sign-and-reject";
import { SignAndRejectV2 } from "@/components/proposals/sign-and-reject-v2";
import type { ProposalMilestoneJson } from "@/app/actions/proposals";

export const dynamic = "force-dynamic";

// Public, unauthenticated page. The cuid id is the only auth gate — same
// pattern as /m/[token]. Branches on templateVersion: V1 keeps the legacy
// plain-HTML quote (untouched so existing signed proposals look identical);
// V2 renders an embedded PDF + the V2 signing form below it.
export default async function PublicQuotePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proposal = await prisma.proposal.findFirst({
    where: { id, deletedAt: null }
  });

  if (!proposal) {
    return (
      <PublicShell>
        <NotFound />
      </PublicShell>
    );
  }

  // ===== V2: branded PDF flow =====
  if (proposal.templateVersion >= 2) {
    const isSigned = proposal.status === "SIGNED";
    const isRejected = proposal.status === "REJECTED";
    // Pre-signature: serve the HTML view (no chromium needed — fast & reliable
    // even when the puppeteer runtime on Vercel is having a bad day). The HTML
    // is styled for A4 so it looks identical to what the customer will sign.
    // Post-signature: switch to the stored signed PDF so they see their own
    // signature burned into the document.
    const pdfSrc = isSigned
      ? `/api/proposals/${proposal.id}/pdf?mode=signed`
      : `/api/proposals/${proposal.id}/pdf?mode=html`;

    return (
      <PublicShell>
        <article className="space-y-4">
          <header className="rounded-md border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-[18px] font-semibold">
                  {proposal.quoteTitle || "הצעת מחיר"}
                </h1>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  עבור{" "}
                  <span className="font-medium text-foreground">
                    {proposal.customerName}
                  </span>
                </p>
                {proposal.projectLocation && (
                  <p className="text-[12px] text-muted-foreground">
                    מיקום: {proposal.projectLocation}
                  </p>
                )}
                <p className="text-[12px] text-muted-foreground">
                  סכום:{" "}
                  <span className="tabular-nums">
                    {formatILS(proposal.totalAmount)}
                  </span>{" "}
                  <span className="text-[11px]">
                    ({proposal.pricesIncludeVat
                      ? "כולל מע״מ"
                      : "בתוספת מע״מ 18%"})
                  </span>
                </p>
              </div>
              <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
                {PROPOSAL_STATUS_LABEL[proposal.status]}
              </Badge>
            </div>
          </header>

          <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                המסמך לחתימה
              </h2>
              <a
                href={pdfSrc}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3" />
                פתח ב-PDF
              </a>
            </div>
            <iframe
              src={pdfSrc}
              title="הצעת מחיר"
              className="h-[78vh] w-full bg-white"
            />
          </section>

          {isSigned ? (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-50/50 p-4 dark:bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                <h2 className="text-[14px] font-semibold">תודה! ההצעה נחתמה</h2>
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                נחתמה על ידי{" "}
                <span className="font-medium text-foreground">
                  {proposal.signedName}
                </span>{" "}
                (ת.ז {proposal.signedIdNumber}) בתאריך{" "}
                <span className="tabular-nums">
                  {formatDateTime(proposal.signedAt)}
                </span>
                .
              </div>
              <a
                href={`/api/proposals/${proposal.id}/pdf?mode=signed`}
                target="_blank"
                rel="noopener"
                className="mt-3 inline-flex items-center gap-1.5 rounded border border-emerald-600 bg-emerald-600 px-4 py-1.5 text-[13px] font-medium text-white hover:opacity-90"
              >
                <Download className="size-3.5" />
                הורד הצעה חתומה
              </a>
            </div>
          ) : isRejected ? (
            <div className="rounded-md border border-red-500/40 bg-red-50/50 p-4 dark:bg-red-500/5">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-red-600" />
                <h2 className="text-[14px] font-semibold">
                  ההצעה סומנה כנדחתה
                </h2>
              </div>
              {proposal.rejectionReason && (
                <div className="mt-2 text-[12px] text-muted-foreground">
                  סיבה: <em>{proposal.rejectionReason}</em>
                </div>
              )}
            </div>
          ) : (
            <section className="rounded-md border bg-card p-4">
              <h2 className="mb-1 text-[14px] font-semibold">אישור וחתימה</h2>
              <p className="mb-3 text-[12px] text-muted-foreground">
                לאחר קריאת המסמך לעיל, מלא את הפרטים וחתום. החתימה תוטמע במסמך
                ה-PDF, ועותק חתום יישמר אצלנו במערכת ויישלח אליך.
              </p>
              <SignAndRejectV2
                proposalId={proposal.id}
                proposalPhone={proposal.customerPhone}
              />
            </section>
          )}
        </article>
      </PublicShell>
    );
  }

  // ===== V1: legacy plain-HTML quote — unchanged =====
  const milestones = Array.isArray(proposal.milestones)
    ? (proposal.milestones as unknown as ProposalMilestoneJson[])
    : [];

  return (
    <PublicShell>
      <article className="space-y-4">
        <header className="rounded-md border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-[18px] font-semibold">הצעת מחיר</h1>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                עבור{" "}
                <span className="font-medium text-foreground">
                  {proposal.customerName}
                </span>
              </p>
              {proposal.projectLocation && (
                <p className="text-[12px] text-muted-foreground">
                  מיקום: {proposal.projectLocation}
                </p>
              )}
            </div>
            <Badge variant={PROPOSAL_STATUS_VARIANT[proposal.status]}>
              {PROPOSAL_STATUS_LABEL[proposal.status]}
            </Badge>
          </div>
        </header>

        <section className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              תנאים מסחריים
            </h2>
            <div className="text-[14px]">
              סכום כולל:{" "}
              <span className="font-semibold tabular-nums">
                {formatILS(proposal.totalAmount)}
              </span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>תיאור</th>
                <th className="w-28 text-end">סכום</th>
                <th className="w-28">תאריך יעד</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, i) => (
                <tr key={i}>
                  <td className="text-center text-[12px] tabular-nums">{i + 1}</td>
                  <td className="text-[13px]">{m.description}</td>
                  <td className="text-end text-[13px] tabular-nums font-medium">
                    {formatILS(m.amount)}
                  </td>
                  <td className="text-[12px] tabular-nums text-muted-foreground">
                    {m.dueDate ? formatDate(m.dueDate) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {proposal.terms && (
          <section className="rounded-md border bg-card">
            <h2 className="border-b bg-muted/30 px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              תנאים והערות
            </h2>
            <div className="whitespace-pre-wrap px-3 py-3 text-[13px] leading-relaxed">
              {proposal.terms}
            </div>
          </section>
        )}

        {proposal.status === "SIGNED" ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-50/50 p-4 dark:bg-emerald-500/5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <h2 className="text-[14px] font-semibold">תודה! ההצעה נחתמה</h2>
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              נחתמה על ידי <span className="font-medium text-foreground">{proposal.signedName}</span>{" "}
              בתאריך <span className="tabular-nums">{formatDateTime(proposal.signedAt)}</span>.
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              נחזור אליך בקרוב להתחלת העבודה.
            </div>
          </div>
        ) : proposal.status === "REJECTED" ? (
          <div className="rounded-md border border-red-500/40 bg-red-50/50 p-4 dark:bg-red-500/5">
            <div className="flex items-center gap-2">
              <XCircle className="size-5 text-red-600" />
              <h2 className="text-[14px] font-semibold">ההצעה סומנה כנדחתה</h2>
            </div>
            {proposal.rejectionReason && (
              <div className="mt-2 text-[12px] text-muted-foreground">
                סיבה: <em>{proposal.rejectionReason}</em>
              </div>
            )}
          </div>
        ) : (
          <section className="rounded-md border bg-card p-4">
            <h2 className="mb-2 text-[14px] font-semibold">אישור וחתימה</h2>
            <p className="mb-3 text-[12px] text-muted-foreground">
              לחתימה על ההצעה, הזן את שמך המלא ו/או חתום בריבוע למטה.
            </p>
            <SignAndReject proposalId={proposal.id} />
          </section>
        )}
      </article>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4 py-3">
          <Image
            src="/logo.png"
            alt="מקובצקי — ניהול פרויקטים"
            width={600}
            height={300}
            priority
            className="h-auto w-full max-w-[260px] object-contain"
          />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <footer className="mx-auto max-w-3xl px-4 py-4 text-center text-[10px] text-muted-foreground">
        מקובצקי — ניהול פרויקטים. הצעת מחיר מקוונת.
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="rounded-md border bg-card p-6 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-500" />
      <h1 className="mt-2 text-[15px] font-semibold">ההצעה לא נמצאה</h1>
      <p className="mt-1 text-[12px] text-muted-foreground">
        ייתכן שהקישור פג תוקף או שההצעה הוסרה. אנא צור קשר עם השולח.
      </p>
    </div>
  );
}
