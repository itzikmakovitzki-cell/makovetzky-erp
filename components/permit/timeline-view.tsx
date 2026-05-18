import { prisma } from "@/lib/prisma";
import { GanttChart, type GanttTask } from "@/components/permit/gantt-chart";

// Server wrapper: pulls just the columns the Gantt actually needs and
// pre-computes "hasUnmetDeps" so the client doesn't have to traverse the
// dependsOn graph itself.
export async function TimelineView({ permitId }: { permitId: string }) {
  const tasks = await prisma.task.findMany({
    where: { permitId, deletedAt: null },
    select: {
      id: true,
      name: true,
      category: true,
      responsibility: true,
      status: true,
      priority: true,
      frozen: true,
      isSpotlight: true,
      startDate: true,
      dueDate: true,
      assignee: { select: { name: true } },
      dependsOn: {
        select: {
          overriddenByAdmin: true,
          dependsOn: { select: { status: true } }
        }
      }
    },
    orderBy: [{ category: "asc" }, { startDate: "asc" }, { dueDate: "asc" }]
  });

  const serialized: GanttTask[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    responsibility: t.responsibility,
    status: t.status,
    priority: t.priority,
    frozen: t.frozen,
    isSpotlight: t.isSpotlight,
    startDate: t.startDate?.toISOString() ?? null,
    dueDate: t.dueDate?.toISOString() ?? null,
    assigneeName: t.assignee?.name ?? null,
    hasUnmetDeps: t.dependsOn.some(
      (d) => d.dependsOn.status !== "COMPLETED" && !d.overriddenByAdmin
    )
  }));

  return <GanttChart tasks={serialized} />;
}
