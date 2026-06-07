-- Block 44 — featured suppliers ("ספקי זהב") on /portal/partners.
-- When `isFeatured` AND `isPublic`, the supplier sorts first on the
-- marketplace and gets the gold-trim card + "מומלץ" badge. Admin-only
-- toggle on the supplier form.

ALTER TABLE "Supplier"
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Supplier_isFeatured_idx" ON "Supplier" ("isFeatured");
