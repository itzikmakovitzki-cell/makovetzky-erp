-- Block 34 — per-task progress notes ("הערות משימה").
-- One row per note. Free-text content authored by ADMIN, EMPLOYEE, or
-- CONTRACTOR (the latter via the portal, gated by PortalAccess to the
-- task's permit). Surfaced inside the back-office TaskEditDialog, inline
-- on the tasks table, and on /portal/permit/[id] so every role has a
-- running log of what's been done on each task.
--
-- Distinct from:
--   * Task.description   — static brief / definition of done.
--   * Note (permit-level) — project-wide context (legal, history, etc.).
--   * AuditLog           — system events, not human commentary.

CREATE TABLE "TaskNote" (
    "id"        TEXT         NOT NULL,
    "taskId"    TEXT         NOT NULL,
    "content"   TEXT         NOT NULL,
    "authorId"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- Cascade with the task (Block 20 convention — deleting a task clears its
-- notes too). Author SET NULL so an offboarded user doesn't wipe the log.
ALTER TABLE "TaskNote"
  ADD CONSTRAINT "TaskNote_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskNote"
  ADD CONSTRAINT "TaskNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lookup pattern: "all notes for a task, newest first" + "what did this
-- user log" for audit drill-downs.
CREATE INDEX "TaskNote_taskId_createdAt_idx" ON "TaskNote" ("taskId", "createdAt");
CREATE INDEX "TaskNote_authorId_idx"          ON "TaskNote" ("authorId");
