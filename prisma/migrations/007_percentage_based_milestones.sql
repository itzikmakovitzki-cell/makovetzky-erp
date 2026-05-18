-- Block 19: percentage-based milestone triggers.
-- BillingMilestone.triggerTaskId becomes nullable so we can express
-- percentage-driven milestones that have no anchor task. The existing
-- unique constraint stays — Postgres allows multiple NULLs in a UNIQUE
-- index, so multiple percentage milestones per permit are fine.

BEGIN;

ALTER TABLE "BillingMilestone"
  ALTER COLUMN "triggerTaskId" DROP NOT NULL;

ALTER TABLE "BillingMilestone"
  ADD COLUMN IF NOT EXISTS "triggerPercentage" INTEGER;

ALTER TABLE "DealMilestone"
  ADD COLUMN IF NOT EXISTS "triggerPercentage" INTEGER;

COMMIT;
