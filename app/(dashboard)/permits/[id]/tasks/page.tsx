import { prisma } from "@/lib/prisma";
import { TasksTable } from "@/components/permit/tasks-table";
import { TimelineView } from "@/components/permit/timeline-view";
import { TasksViewToggle } from "@/components/permit/tasks-view-toggle";
import { AuthoritySubmissionsStrip } from "@/components/permit/authority-submissions-strip";

export const dynamic = "force-dynamic";

export default async function PermitTasksTabPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const [{ id }, { view, category }] = await Promise.all([params, searchParams]);
  const active = view === "timeline" ? "timeline" : "table";
  const categoryFilter = category && category.trim() ? category.trim() : null;

  // Submissions live per (permit, category). Categories present on this
  // permit drive the strip — missing rows = implicit PREPARING. The completion
  // counts come from a groupBy aggregated by both category + status so the
  // strip can show n/m and gate SUBMITTED with a confirm when n<m.
  const [permitCategoryRows, submissions, completionRows] = await Promise.all([
    prisma.task.findMany({
      where: { permitId: id, deletedAt: null, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" }
    }),
    prisma.authoritySubmission.findMany({
      where: { permitId: id },
      select: {
        category: true,
        status: true,
        submittedAt: true,
        decidedAt: true,
        decisionNotes: true
      }
    }),
    prisma.task.groupBy({
      by: ["category", "status"],
      where: { permitId: id, deletedAt: null, category: { not: null } },
      _count: { _all: true }
    })
  ]);
  const permitCategories = permitCategoryRows
    .map((r) => r.category)
    .filter((c): c is string => !!c);

  // Roll the per-(category,status) counts into per-category totals.
  const completionByCategory: Record<
    string,
    { total: number; completed: number }
  > = {};
  for (const r of completionRows) {
    if (!r.category) continue;
    const entry =
      completionByCategory[r.category] ??
      (completionByCategory[r.category] = { total: 0, completed: 0 });
    entry.total += r._count._all;
    if (r.status === "COMPLETED") entry.completed += r._count._all;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <TasksViewToggle active={active} />
      </div>
      {active === "table" && permitCategories.length > 0 && (
        <AuthoritySubmissionsStrip
          permitId={id}
          categories={permitCategories}
          submissions={submissions}
          completionByCategory={completionByCategory}
        />
      )}
      {active === "timeline" ? (
        <TimelineView permitId={id} />
      ) : (
        <TasksTable permitId={id} categoryFilter={categoryFilter} />
      )}
    </div>
  );
}
