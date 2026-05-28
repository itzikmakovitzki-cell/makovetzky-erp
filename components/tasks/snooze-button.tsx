"use client";

import { useTransition } from "react";
import { AlarmClock, Loader2, Sun, CalendarPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { snoozeTask } from "@/app/actions/tasks";
import { cn } from "@/lib/utils";

// ⏰ Snooze control. Opens a tiny menu offering +1 day / +7 days; both fire
// snoozeTask which moves the due date AND increments snoozeCount server-side.
export function SnoozeButton({
  taskId,
  align = "end",
  className
}: {
  taskId: string;
  align?: "start" | "end";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  const snooze = (days: number) => {
    startTransition(async () => {
      const res = await snoozeTask(taskId, days);
      if (!res.ok && res.error) window.alert(res.error);
    });
  };

  return (
    <DropdownMenu align={align}>
      <DropdownMenuTrigger
        disabled={pending}
        title="דחיית תאריך יעד"
        aria-label="דחיית תאריך יעד"
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50",
          className
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <AlarmClock className="size-4" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[11rem]">
        <DropdownMenuLabel>דחיית המשימה</DropdownMenuLabel>
        <DropdownMenuItem icon={<Sun className="size-3.5" />} onSelect={() => snooze(1)}>
          דחה למחר
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<CalendarPlus className="size-3.5" />}
          onSelect={() => snooze(7)}
        >
          דחה לשבוע הבא
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
