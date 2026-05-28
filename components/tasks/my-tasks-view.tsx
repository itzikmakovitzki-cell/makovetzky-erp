"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { MyTasksTable } from "@/components/tasks/my-tasks-table";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { cn } from "@/lib/utils";
import type { MyTask, AssigneeOption } from "@/components/tasks/my-tasks-types";

type View = "table" | "kanban";

export function MyTasksView({
  tasks,
  users
}: {
  tasks: MyTask[];
  users: AssigneeOption[];
}) {
  const [view, setView] = useState<View>("table");

  // Remember the user's preferred view across visits.
  useEffect(() => {
    const saved = window.localStorage.getItem("myTasksView");
    if (saved === "kanban" || saved === "table") setView(saved);
  }, []);

  const choose = (v: View) => {
    setView(v);
    window.localStorage.setItem("myTasksView", v);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <ToggleBtn
            active={view === "table"}
            onClick={() => choose("table")}
            icon={<Table2 className="size-3.5" />}
            label="טבלה"
          />
          <ToggleBtn
            active={view === "kanban"}
            onClick={() => choose("kanban")}
            icon={<LayoutGrid className="size-3.5" />}
            label="קנבן"
          />
        </div>
      </div>

      {view === "table" ? (
        <MyTasksTable tasks={tasks} users={users} />
      ) : (
        <KanbanBoard tasks={tasks} />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
