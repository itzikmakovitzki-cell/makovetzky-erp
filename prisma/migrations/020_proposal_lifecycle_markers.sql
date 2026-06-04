-- V2 lifecycle: track when a proposal was sent, when it expires (14d after
-- send), when we last reminded the customer to sign, and when we notified
-- the admin of a customer signature. All nullable so legacy / draft rows
-- are unaffected. The expiration is "soft" — the public page checks at
-- render time, so flipping the timestamp later doesn't break archived rows.

ALTER TABLE "Proposal"
  ADD COLUMN "sentAt"           TIMESTAMP(3),
  ADD COLUMN "expiresAt"        TIMESTAMP(3),
  ADD COLUMN "reminderSentAt"   TIMESTAMP(3),
  ADD COLUMN "adminNotifiedAt"  TIMESTAMP(3);

-- For existing SENT V2 rows (very few, possibly none in production) we
-- approximate sentAt = updatedAt and expiresAt = updatedAt + 14d so the
-- cron doesn't try to re-notify them or treat them as never-sent.
UPDATE "Proposal"
  SET "sentAt"    = "updatedAt",
      "expiresAt" = "updatedAt" + INTERVAL '14 days'
  WHERE "templateVersion" >= 2
    AND "status" = 'SENT'
    AND "deletedAt" IS NULL;
