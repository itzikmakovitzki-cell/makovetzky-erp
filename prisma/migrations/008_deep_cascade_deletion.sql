-- Block 20: deep cascade. Production was throwing on permit/deal deletes
-- because BillingMilestone, Document, Permit->MasterDeal, and MagicLink all
-- had Restrict/SetNull FKs that fought the actual delete path. Flip every
-- relation the admin intends to cascade.

BEGIN;

ALTER TABLE "Permit"
  DROP CONSTRAINT "Permit_masterDealId_fkey";
ALTER TABLE "Permit"
  ADD CONSTRAINT "Permit_masterDealId_fkey"
  FOREIGN KEY ("masterDealId") REFERENCES "MasterDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingMilestone"
  DROP CONSTRAINT "BillingMilestone_permitId_fkey";
ALTER TABLE "BillingMilestone"
  ADD CONSTRAINT "BillingMilestone_permitId_fkey"
  FOREIGN KEY ("permitId") REFERENCES "Permit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillingMilestone"
  DROP CONSTRAINT "BillingMilestone_triggerTaskId_fkey";
ALTER TABLE "BillingMilestone"
  ADD CONSTRAINT "BillingMilestone_triggerTaskId_fkey"
  FOREIGN KEY ("triggerTaskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Document"
  DROP CONSTRAINT "Document_permitId_fkey";
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_permitId_fkey"
  FOREIGN KEY ("permitId") REFERENCES "Permit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MagicLink"
  DROP CONSTRAINT "MagicLink_permitId_fkey";
ALTER TABLE "MagicLink"
  ADD CONSTRAINT "MagicLink_permitId_fkey"
  FOREIGN KEY ("permitId") REFERENCES "Permit"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MagicLink"
  DROP CONSTRAINT "MagicLink_taskId_fkey";
ALTER TABLE "MagicLink"
  ADD CONSTRAINT "MagicLink_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
