import { notFound } from "next/navigation";
import { Wallet, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermitHeader } from "@/components/permit/permit-header";
import { PermitTabs } from "@/components/permit/permit-tabs";
import { SheetButton } from "@/components/global/sheet-button";
import { FinanceSummary } from "@/components/permit/finance-summary";
import { DocumentsSummary } from "@/components/permit/documents-summary";
import { CompletionBanner } from "@/components/permit/completion-banner";
import { InvitePartnerButton } from "@/components/permit/invite-partner-button";
import { GenerateBinderButton } from "@/components/permits/generate-binder-button";

export const dynamic = "force-dynamic";

export default async function PermitLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const permit = await prisma.permit.findFirst({
    where: { id, deletedAt: null },
    include: {
      authority: true,
      masterDeal: { include: { client: true } }
    }
  });

  if (!permit) notFound();

  const [taskTotal, taskCompleted, financeCount, docsCount, notesCount, contactsCount, partnerSuppliers] = await Promise.all([
    prisma.task.count({ where: { permitId: id, deletedAt: null } }),
    prisma.task.count({ where: { permitId: id, status: "COMPLETED", deletedAt: null } }),
    prisma.billingMilestone.count({ where: { permitId: id } }),
    prisma.document.count({ where: { permitId: id, deletedAt: null } }),
    prisma.note.count({ where: { permitId: id } }),
    // Block 33: per-permit phonebook count for the new "אנשי קשר" tab pill.
    prisma.projectContact.count({ where: { permitId: id } }),
    // Block 30: public suppliers feed the "הזמן ספק" dialog in the action row.
    prisma.supplier.findMany({
      where: { isPublic: true },
      select: { id: true, name: true, type: true, marketingDescription: true },
      orderBy: { name: "asc" }
    })
  ]);

  const progressPercent = taskTotal === 0 ? 0 : Math.round((taskCompleted / taskTotal) * 100);

  // Banner logic:
  // - permit COMPLETED → show "locked" banner with reopen button
  // - permit not COMPLETED but every task done (and there's at least one) →
  //   prompt the admin to close the permit
  // Banner appears above tabs so it's visible on every sub-page.
  const isLocked = permit.status === "COMPLETED";
  const suggestCompletion =
    !isLocked &&
    permit.status !== "CANCELLED" &&
    taskTotal > 0 &&
    taskCompleted === taskTotal;
  const showBanner = isLocked || suggestCompletion;

  return (
    <div className="flex flex-col gap-3">
      <PermitHeader
        permit={permit}
        progressPercent={progressPercent}
        taskTotal={taskTotal}
        taskCompleted={taskCompleted}
      />
      {showBanner && (
        <CompletionBanner
          permitId={id}
          mode={isLocked ? "locked" : "suggest-completion"}
          taskCompleted={taskCompleted}
          taskTotal={taskTotal}
          isAdmin={isAdmin}
        />
      )}
      <PermitTabs
        permitId={id}
        counts={{
          tasks: taskTotal,
          finances: financeCount,
          documents: docsCount,
          contacts: contactsCount,
          notes: notesCount
        }}
      />
      {/* Block 23: financial data is fully hidden by default — it only renders
          inside the "ניהול פיננסי" side drawer, so the permit screen is safe to
          present to a client at any time. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {/* Block 41 — 1-click municipality binder. The headline action
              for the PM; sits left of the partner / finance / docs
              utilities so it's the first thing the eye lands on. */}
          <GenerateBinderButton permitId={id} variant="primary" />
          <InvitePartnerButton
            permitId={id}
            permitLabel={permit.name}
            suppliers={partnerSuppliers}
          />
          <SheetButton
            label="ניהול פיננסי"
            title={`ניהול פיננסי — ${permit.name}`}
            tone="finance"
            icon={<Wallet className="size-3.5" />}
          >
            <FinanceSummary permitId={id} />
          </SheetButton>
          <SheetButton
            label="מסמכים"
            title={`מסמכים — ${permit.name}`}
            icon={<FileText className="size-3.5" />}
          >
            <DocumentsSummary permitId={id} />
          </SheetButton>
        </div>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
