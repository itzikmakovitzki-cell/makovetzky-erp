-- Adds per-group "capture every message" toggle for ProjectWhatsAppGroup.
-- Default false: existing groups keep mention-only behavior. When admin
-- flips this on in the project's WhatsApp tab, the green-api webhook
-- ingests every file/message in that group as a PendingDocument.

ALTER TABLE "ProjectWhatsAppGroup"
  ADD COLUMN "captureAllFiles" BOOLEAN NOT NULL DEFAULT FALSE;
