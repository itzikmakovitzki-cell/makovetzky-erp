import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FinanceStats } from "@/components/permit/finance-stats";
import {
  MilestonesTableInteractive,
  type MilestoneRow
} from "@/components/permit/milestones-table-interactive";

export async function FinancesTab({ permitId }: { permitId: string }) {
  const permit = await prisma.permit.findUnique({
    where: { id: permitId },
    select: {
      id: true,
      masterDeal: { select: { totalValue: true } }
    }
  });
  if (!permit) notFound();

  const [milestones, allTasks] = await Promise.all([
    prisma.billingMilestone.findMany({
      where: { permitId },
      include: { triggerTask: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }]
    }),
    prisma.task.findMany({
      where: { permitId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" }
    })
  ]);

  // Decimals + Dates aren't directly serializable to Client Components — flatten.
  const serializedMilestones: MilestoneRow[] = milestones.map((m) => ({
    id: m.id,
    permitId: m.permitId,
    name: m.name,
    amount: Number(m.amount.toString()),
    status: m.status,
    dueDate: m.dueDate ? m.dueDate.toISOString() : null,
    triggerTaskId: m.triggerTaskId,
    triggerTaskName: m.triggerTask.name,
    notes: m.notes
  }));

  const usedTaskIds = new Set(serializedMilestones.map((m) => m.triggerTaskId));
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
      />
    </div>
  );
}
