-- Block 30 (Partners Marketplace). Three new Supplier columns that drive
-- whether the supplier shows up in the client portal grid (/portal/partners)
-- and on the PM "הזמן ספק" dialog inside the permit dashboard.
--
--   * isPublic              — explicit opt-in. Default false so existing
--                              suppliers stay back-office only until the
--                              admin flips them on.
--   * marketingDescription  — client-facing pitch ("מעבדת בדיקות חשמל
--                              מורשית, 24h SLA"). Kept separate from the
--                              back-office `services` field which is
--                              admin shorthand.
--   * logoUrl               — either a Supabase Storage path (preferred,
--                              resolved via signed URL at render time) or
--                              an absolute https URL.

ALTER TABLE "Supplier"
  ADD COLUMN "isPublic"             BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingDescription" TEXT,
  ADD COLUMN "logoUrl"              TEXT;

-- Index for the portal marketplace query: WHERE "isPublic" = true ORDER BY name.
CREATE INDEX "Supplier_isPublic_idx" ON "Supplier" ("isPublic");
