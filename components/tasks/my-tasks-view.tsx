"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, Table2 } from "lucide-react";
import { MyTasksTable } from "@/components/tasks/my-tasks-table";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { MyTaskMobileCard } from "@/components/tasks/my-task-mobile-card";
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
    <div className="flex flex-col gap-4">
      <div className="hidden items-center justify-between md:flex">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">השלב הבא</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight text-brand-navy">המשימות שמחכות לך</h2>
        </div>
        <div className="inline-flex rounded-xl border border-white/80 bg-white/90 p-1 shadow-sm">
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

      <div className="flex flex-col gap-3 md:hidden">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white/70 px-5 py-12 text-center text-sm text-muted-foreground">
            אין משימות שמתאימות לסינון. אפשר לנקות אותו ולחזור לתמונה המלאה.
          </div>
        ) : (
          tasks.map((t) => <MyTaskMobileCard key={t.id} task={t} users={users} />)
        )}
      </div>

      <div className="hidden md:block">
        {view === "table" ? (
          <MyTasksTable tasks={tasks} users={users} />
        ) : (
          <KanbanBoard tasks={tasks} />
        )}
      </div>
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
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-200",
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
