-- Block 38 — Marketplace Pro & Smart CRM Triggers.
--
-- Three new columns:
--
--   * Supplier.deliverables  — newline-separated bullet list of what the
--                              service actually includes ("בדיקת חשמל
--                              מלאה\nדו'\'ח חתום\nתעודת בדיקה רשמית").
--                              Rendered with check-marks in the portal
--                              marketplace card.
--   * Supplier.priceEstimate — short, free-text price line ("2,100 ₪
--                              במקום 2,500 ₪", "החל מ-1,800 ₪").
--                              Pinned above the "בקש שירות" CTA.
--   * Client.clientType      — explicit segmentation set by the PM in
--                              the client form. "PRIVATE" (homeowner)
--                              gates the Form-4 home-entry upsell;
--                              "BUSINESS" (contractor / developer)
--                              never receives the private-buyer copy.
--                              String column (not an enum) so future
--                              tiers don't require a schema migration.

ALTER TABLE "Supplier"
  ADD COLUMN "deliverables"  TEXT,
  ADD COLUMN "priceEstimate" TEXT;

ALTER TABLE "Client"
  ADD COLUMN "clientType" TEXT NOT NULL DEFAULT 'PRIVATE';
