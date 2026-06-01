-- WhatsApp tier 1 + tier 2 (PR-W of the polish sweep).
-- Tier 1: User.phone so the existing Block-25 WhatsAppReminderButton can
-- actually open wa.me for an assignee (until now the phone path was dormant).
-- Tier 2: Client.notificationPreference + enum — controls whether *any*
-- WhatsApp UI appears on a client's profile. Default MANUAL_ONLY so existing
-- behaviour is "admin can send, but must click each one"; OFF hides the
-- button entirely.

ALTER TABLE "User" ADD COLUMN "phone" TEXT;

CREATE TYPE "ClientNotificationPreference" AS ENUM ('OFF', 'MANUAL_ONLY');

ALTER TABLE "Client"
  ADD COLUMN "notificationPreference" "ClientNotificationPreference" NOT NULL DEFAULT 'MANUAL_ONLY';
