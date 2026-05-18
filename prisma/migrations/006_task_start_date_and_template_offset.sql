-- Block 18: Gantt / Timeline view
-- Adds a planned start date to Task and a start offset to TaskTemplate so the
-- timeline can plot a bar's left edge. Both columns are nullable + additive —
-- no defaults to backfill, no existing code path requires them. Existing task
-- generation (which derives dueDate from defaultDurationDays) is unchanged.

BEGIN;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);

ALTER TABLE "TaskTemplate"
  ADD COLUMN IF NOT EXISTS "defaultStartOffsetDays" INTEGER;

COMMIT;
