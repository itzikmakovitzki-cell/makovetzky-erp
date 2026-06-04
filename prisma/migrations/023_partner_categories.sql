-- Block 30 polish #2 — Partner Marketplace categories.
-- New PartnerCategory table + Supplier.categoryId FK + seed rows for the
-- three buckets the customer asked for.

CREATE TABLE "PartnerCategory" (
  "id"           TEXT          NOT NULL PRIMARY KEY,
  "name"         TEXT          NOT NULL,
  "description"  TEXT,
  "displayOrder" INTEGER       NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL
);

CREATE UNIQUE INDEX "PartnerCategory_name_key" ON "PartnerCategory" ("name");
CREATE INDEX "PartnerCategory_displayOrder_idx" ON "PartnerCategory" ("displayOrder");

ALTER TABLE "Supplier"
  ADD COLUMN "categoryId" TEXT,
  ADD CONSTRAINT "Supplier_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "PartnerCategory" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Supplier_categoryId_idx" ON "Supplier" ("categoryId");

-- Seed the three buckets the brief listed. Hard-coded ids so re-applying
-- the migration in CI / preview stacks lands on the same rows the docs
-- assume; updatedAt uses CURRENT_TIMESTAMP because we don't run prisma's
-- @updatedAt logic on raw INSERT.
INSERT INTO "PartnerCategory" ("id", "name", "description", "displayOrder", "updatedAt")
VALUES
  ('pcat_professionals', 'בעלי מקצוע', 'חשמלאים, שרברבים, מודדים, יועצים ובעלי מקצוע נוספים.', 10, CURRENT_TIMESTAMP),
  ('pcat_home_entry',    'כניסה לבית', 'שירותי כניסה לדירה — ניקיון יסודי, התקנת מטבחים וריהוט, חשמל ראשוני.', 20, CURRENT_TIMESTAMP),
  ('pcat_services',      'נותני שירות', 'משרדי ייעוץ, שירותים מקצועיים, חברות תחזוקה ושירותים שוטפים.', 30, CURRENT_TIMESTAMP);
