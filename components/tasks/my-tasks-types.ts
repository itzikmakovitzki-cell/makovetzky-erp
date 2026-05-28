import type { TaskStatus, TaskPriority } from "@prisma/client";

// Serializable, client-safe shape for a task row/card in the personal inbox.
// Dates are pre-formatted to ISO strings and due-state is computed server-side
// to avoid timezone/hydration drift in the client views.
export type DueState = "overdue" | "today" | "future" | null;

export type MyTask = {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  frozen: boolean;
  isSpotlight: boolean;
  /** ISO date part (YYYY-MM-DD) or null. */
  dueDate: string | null;
  dueState: DueState;
  assigneeId: string | null;
  assigneeName: string | null;
  permitId: string;
  permitName: string;
  permitNumber: string | null;
  clientId: string;
  clientName: string;
};

export type AssigneeOption = { id: string; name: string };
