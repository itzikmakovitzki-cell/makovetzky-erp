-- Enforce, at the DB level, two invariants that were previously only
-- documented in comments:
--   1. BillingMilestone: exactly one of triggerTaskId / triggerPercentage is
--      set (task-anchored vs percentage-anchored milestone).
--   2. MagicLink: taskId and permitId are always set together (both null or
--      both present) — every magic link is minted for a specific task on a
--      specific permit, never one without the other.
-- Verified against production data before adding (0 violating rows in
-- either table) so this is safe to apply without a backfill.

ALTER TABLE "BillingMilestone"
  ADD CONSTRAINT billing_milestone_trigger_xor
  CHECK (num_nonnulls("triggerTaskId", "triggerPercentage") = 1);

ALTER TABLE "MagicLink"
  ADD CONSTRAINT magic_link_task_permit_together
  CHECK (("taskId" IS NULL) = ("permitId" IS NULL));
