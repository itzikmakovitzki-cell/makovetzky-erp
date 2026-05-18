import { TasksTable } from "@/components/permit/tasks-table";
import { TimelineView } from "@/components/permit/timeline-view";
import { TasksViewToggle } from "@/components/permit/tasks-view-toggle";

export const dynamic = "force-dynamic";

export default async function PermitTasksTabPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  const active = view === "timeline" ? "timeline" : "table";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <TasksViewToggle active={active} />
      </div>
      {active === "timeline" ? (
        <TimelineView permitId={id} />
      ) : (
        <TasksTable permitId={id} />
      )}
    </div>
  );
}
