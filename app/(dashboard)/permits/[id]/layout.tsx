import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PermitHeader } from "@/components/permit/permit-header";
import { PermitTabs } from "@/components/permit/permit-tabs";
import { SplitView } from "@/components/permit/split-view";
import { FinanceSummary } from "@/components/permit/finance-summary";
import { DocumentsSummary } from "@/components/permit/documents-summary";
import { CompletionBanner } from "@/components/permit/completion-banner";

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

  const [taskTotal, taskCompleted, financeCount, docsCount, notesCount] = await Promise.all([
    prisma.task.count({ where: { permitId: id, deletedAt: null } }),
    prisma.task.count({ where: { permitId: id, status: "COMPLETED", deletedAt: null } }),
    prisma.billingMilestone.count({ where: { permitId: id } }),
    prisma.document.count({ where: { permitId: id, deletedAt: null } }),
    prisma.note.count({ where: { permitId: id } })
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
          notes: notesCount
        }}
      />
      <SplitView
        finance={<FinanceSummary permitId={id} />}
        documents={<DocumentsSummary permitId={id} />}
      >
        {children}
      </SplitView>
    </div>
  );
}
