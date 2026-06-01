-- Spec: docs/spec-whatsapp-groups.md §3.3 (PR-3).
-- Optional columns for inbound documents that came from a WhatsApp group.
-- All nullable / additive — when source is the legacy WHATSAPP private chat,
-- email, portal, or manual upload, they stay NULL.
--   groupChatId       = "972...-1638...@g.us" — links back to ProjectWhatsAppGroup
--   authorName        = senderName from the green-api webhook (group member name)
--   authorPhone       = phone of the group member who sent the file
--   suggestedTaskName = parsed from the caption ("@מקובצקי טופס 4 חתום" → "טופס 4 חתום")
--
-- We index groupChatId so the per-project timeline (Section C) can pull a
-- group's history efficiently. status+createdAt index is already covered by
-- the original migration.

ALTER TABLE "PendingDocument"
  ADD COLUMN "groupChatId"       TEXT,
  ADD COLUMN "authorName"        TEXT,
  ADD COLUMN "authorPhone"       TEXT,
  ADD COLUMN "suggestedTaskName" TEXT;

CREATE INDEX "PendingDocument_groupChatId_idx"
  ON "PendingDocument"("groupChatId");
