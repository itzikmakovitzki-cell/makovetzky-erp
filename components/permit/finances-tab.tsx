import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FinanceStats } from "@/components/permit/finance-stats";
import {
  MilestonesTableInteractive,
  type MilestoneRow
} from "@/components/permit/milestones-table-interactive";

export async function FinancesTab({ permitId }: { permitId: string }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: {
      id: true,
      masterDeal: { select: { totalValue: true } }
    }
  });
  if (!permit) notFound();

  const [milestones, allTasks, completedTaskCount] = await Promise.all([
    prisma.billingMilestone.findMany({
      where: { permitId },
      include: { triggerTask: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }]
    }),
    prisma.task.findMany({
      where: { permitId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" }
    }),
    prisma.task.count({
      where: { permitId, deletedAt: null, status: "COMPLETED" }
    })
  ]);

  const totalTaskCount = allTasks.length;
  const permitCompletionPct =
    totalTaskCount === 0
      ? 0
      : Math.round((completedTaskCount / totalTaskCount) * 100);

  // Decimals + Dates aren't directly serializable to Client Components — flatten.
  // triggerTaskId is nullable now (Block 19: percentage-based milestones).
  const serializedMilestones: MilestoneRow[] = milestones.map((m) => ({
    id: m.id,
    permitId: m.permitId,
    name: m.name,
    amount: Number(m.amount.toString()),
    status: m.status,
    dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    triggerTaskId: m.triggerTaskId,
    triggerTaskName: m.triggerTask?.name ?? null,
    triggerPercentage: m.triggerPercentage,
    notes: m.notes
  }));

  const usedTaskIds = new Set(
    serializedMilestones
      .map((m) => m.triggerTaskId)
      .filter((id): id is string => id !== null)
  );
  const availableTasksForCreate = allTasks.filter((t) => !usedTaskIds.has(t.id));

  const dealValue = permit.masterDeal.totalValue
    ? Number(permit.masterDeal.totalValue.toString())
    : 0;
  const paidAmount = serializedMilestones
    .filter((m) => m.status === "PAID")
    .reduce((s, m) => s + m.amount, 0);
  const dueAmount = serializedMilestones
    .filter((m) => m.status === "DUE")
    .reduce((s, m) => s + m.amount, 0);
  const pendingAmount = serializedMilestones
    .filter((m) => m.status === "PENDING")
    .reduce((s, m) => s + m.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <FinanceStats
        dealValue={dealValue}
        paidAmount={paidAmount}
        dueAmount={dueAmount}
        pendingAmount={pendingAmount}
      />
      <MilestonesTableInteractive
        permitId={permitId}
        milestones={serializedMilestones}
        allTasks={allTasks}
        availableTasksForCreate={availableTasksForCreate}
        permitCompletionPct={permitCompletionPct}
        permitCompletedCount={completedTaskCount}
        permitTotalCount={totalTaskCount}
        isAdmin={isAdmin}
      />
    </div>
  );
}
