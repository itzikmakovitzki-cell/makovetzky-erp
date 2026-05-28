-- Block 25: snooze tracking. A new column records how many times a task's due
-- date was pushed via the Snooze action, so the PM can spot chronically
-- slipping tasks. Additive + NOT NULL DEFAULT 0 — every existing row stays valid.

BEGIN;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "snoozeCount" INTEGER NOT NULL DEFAULT 0;

COMMIT;
