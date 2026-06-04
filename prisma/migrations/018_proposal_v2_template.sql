-- Proposal V2 — branded PDF + richer signing audit.
--
-- All new columns are additive and nullable / defaulted so existing rows
-- (signed proposals customers already saw) are left exactly as they are.
-- The new public signing flow only kicks in for templateVersion >= 2.
--
-- DRAFT proposals — never sent, never seen by anyone — are bumped to V2
-- so the admin doesn't end up with stale-looking drafts after the cutover.
-- SENT / SIGNED / REJECTED stay on V1 forever.

ALTER TABLE "Proposal"
  ADD COLUMN "templateVersion"    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "quoteTitle"         TEXT,
  ADD COLUMN "serviceDescription" TEXT,
  ADD COLUMN "signedIdNumber"     TEXT,
  ADD COLUMN "signedPhone"        TEXT,
  ADD COLUMN "signedIp"           TEXT,
  ADD COLUMN "signedUserAgent"    TEXT,
  ADD COLUMN "signedPdfPath"      TEXT;

UPDATE "Proposal"
  SET "templateVersion" = 2
  WHERE "status" = 'DRAFT' AND "deletedAt" IS NULL;
