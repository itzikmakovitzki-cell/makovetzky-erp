-- Block 7b: Soft Delete & Recycle Bin
-- Adds nullable `deletedAt` to all soft-deletable models, plus indexes.
-- Pure additions — no backfill, no data loss, fully idempotent.
-- Apply BEFORE deploying the code that uses these fields, or Prisma queries
-- will fail with "column does not exist" on every read of these tables.

BEGIN;

ALTER TABLE "Client"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "MasterDeal" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Permit"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task"       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx"     ON "Client"("deletedAt");
CREATE INDEX IF NOT EXISTS "MasterDeal_deletedAt_idx" ON "MasterDeal"("deletedAt");
CREATE INDEX IF NOT EXISTS "Permit_deletedAt_idx"     ON "Permit"("deletedAt");
CREATE INDEX IF NOT EXISTS "Task_deletedAt_idx"       ON "Task"("deletedAt");
CREATE INDEX IF NOT EXISTS "Document_deletedAt_idx"   ON "Document"("deletedAt");

COMMIT;
