-- Spec: docs/spec-whatsapp-groups.md (PR-2).
-- 1:1 between MasterDeal and its WhatsApp group. masterDealId is nullable
-- because inbound groups that messaged the system BEFORE the admin connected
-- them to a project ("orphans") land in the same table with masterDealId =
-- NULL and surface on /inbox until the admin picks the right project.
-- Postgres allows many NULLs in a regular unique constraint, so @unique on
-- the nullable column gives us "one row per project, unlimited orphans".
-- whatsappDefaultRoute lands on MasterDeal with default GROUP — for legacy
-- projects without a connected group the UI shows a disabled button instead
-- of silently sending to nobody. groupChatId @unique = a WhatsApp group can
-- only belong to one project (catches accidental double-connect).

CREATE TYPE "WhatsAppDefaultRoute" AS ENUM ('GROUP', 'CLIENT_DIRECT', 'NONE');

ALTER TABLE "MasterDeal"
  ADD COLUMN "whatsappDefaultRoute" "WhatsAppDefaultRoute" NOT NULL DEFAULT 'GROUP';

CREATE TABLE "ProjectWhatsAppGroup" (
  "id"            TEXT NOT NULL,
  "masterDealId"  TEXT,
  "groupChatId"   TEXT NOT NULL,
  "groupName"     TEXT,
  "connectedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "connectedById" TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProjectWhatsAppGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectWhatsAppGroup_masterDealId_key"
  ON "ProjectWhatsAppGroup"("masterDealId");

CREATE UNIQUE INDEX "ProjectWhatsAppGroup_groupChatId_key"
  ON "ProjectWhatsAppGroup"("groupChatId");

CREATE INDEX "ProjectWhatsAppGroup_isActive_idx"
  ON "ProjectWhatsAppGroup"("isActive");

ALTER TABLE "ProjectWhatsAppGroup"
  ADD CONSTRAINT "ProjectWhatsAppGroup_masterDealId_fkey"
  FOREIGN KEY ("masterDealId") REFERENCES "MasterDeal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectWhatsAppGroup"
  ADD CONSTRAINT "ProjectWhatsAppGroup_connectedById_fkey"
  FOREIGN KEY ("connectedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
