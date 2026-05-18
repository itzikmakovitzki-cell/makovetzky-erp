-- Block 15: Standalone Proposals + Deal-level Milestones
-- Creates the Proposal table (lightweight pre-deal quotes signable from a
-- public unauthenticated /quote/[id] page), the deal-level DealMilestone
-- table (materialized from a proposal's JSON milestones at conversion), and
-- the ProposalStatus enum. Pure additions — no data backfill required.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProposalStatus') THEN
    CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Proposal" (
  "id"               TEXT             PRIMARY KEY,
  "customerName"     TEXT             NOT NULL,
  "customerPhone"    TEXT             NOT NULL,
  "customerEmail"    TEXT,
  "projectLocation"  TEXT,
  "totalAmount"      DECIMAL(14, 2)   NOT NULL,
  "milestones"       JSONB            NOT NULL,
  "terms"            TEXT,
  "status"           "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "signatureData"    TEXT,
  "signedName"       TEXT,
  "signedAt"         TIMESTAMP(3),
  "rejectionReason"  TEXT,
  "clientId"         TEXT,
  "masterDealId"     TEXT,
  "convertedAt"      TIMESTAMP(3),
  "createdById"      TEXT,
  "deletedAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)     NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposal_clientId_fkey') THEN
    ALTER TABLE "Proposal"
      ADD CONSTRAINT "Proposal_clientId_fkey"
      FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposal_masterDealId_fkey') THEN
    ALTER TABLE "Proposal"
      ADD CONSTRAINT "Proposal_masterDealId_fkey"
      FOREIGN KEY ("masterDealId") REFERENCES "MasterDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Proposal_createdById_fkey') THEN
    ALTER TABLE "Proposal"
      ADD CONSTRAINT "Proposal_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Proposal_status_idx"       ON "Proposal"("status");
CREATE INDEX IF NOT EXISTS "Proposal_clientId_idx"     ON "Proposal"("clientId");
CREATE INDEX IF NOT EXISTS "Proposal_masterDealId_idx" ON "Proposal"("masterDealId");
CREATE INDEX IF NOT EXISTS "Proposal_createdAt_idx"    ON "Proposal"("createdAt");
CREATE INDEX IF NOT EXISTS "Proposal_deletedAt_idx"    ON "Proposal"("deletedAt");

CREATE TABLE IF NOT EXISTS "DealMilestone" (
  "id"           TEXT             PRIMARY KEY,
  "masterDealId" TEXT             NOT NULL,
  "description"  TEXT             NOT NULL,
  "amount"       DECIMAL(14, 2)   NOT NULL,
  "dueDate"      TIMESTAMP(3),
  "status"       "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"       TIMESTAMP(3),
  "orderIndex"   INTEGER          NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)     NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DealMilestone_masterDealId_fkey') THEN
    ALTER TABLE "DealMilestone"
      ADD CONSTRAINT "DealMilestone_masterDealId_fkey"
      FOREIGN KEY ("masterDealId") REFERENCES "MasterDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DealMilestone_masterDealId_status_idx"     ON "DealMilestone"("masterDealId", "status");
CREATE INDEX IF NOT EXISTS "DealMilestone_masterDealId_orderIndex_idx" ON "DealMilestone"("masterDealId", "orderIndex");

COMMIT;
