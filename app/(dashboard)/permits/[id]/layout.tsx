import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PermitHeader } from "@/components/permit/permit-header";
import { PermitTabs } from "@/components/permit/permit-tabs";
import { SplitView } from "@/components/permit/split-view";
import { FinanceSummary } from "@/components/permit/finance-summary";
import { DocumentsSummary } from "@/components/permit/documents-summary";

export const dynamic = "force-dynamic";

export default async function PermitLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  return (
    <div className="flex flex-col gap-3">
      <PermitHeader
        permit={permit}
        progressPercent={progressPercent}
        taskTotal={taskTotal}
        taskCompleted={taskCompleted}
      />
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
