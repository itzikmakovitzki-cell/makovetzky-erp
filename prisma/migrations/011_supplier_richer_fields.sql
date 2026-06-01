-- Phase 1 of the suppliers overhaul (post-MVP).
-- Adds the fields the PM wants for every supplier: website, free-text
-- description of the services they provide, and a richer commission model
-- that supports either a fixed amount or a percentage. Also a default
-- payment-terms string (per-assignment terms still live on the assignment).
--
-- Data fix: the legacy `defaultCommission` column was always a sum in ILS,
-- so existing rows move into (defaultCommissionValue, defaultCommissionType
-- = FIXED). The old column is then dropped.

CREATE TYPE "SupplierCommissionType" AS ENUM ('FIXED', 'PERCENT');

ALTER TABLE "Supplier"
  ADD COLUMN "website"                TEXT,
  ADD COLUMN "services"               TEXT,
  ADD COLUMN "defaultCommissionType"  "SupplierCommissionType",
  ADD COLUMN "defaultCommissionValue" DECIMAL(10, 2),
  ADD COLUMN "defaultPaymentTerms"    TEXT;

UPDATE "Supplier"
SET "defaultCommissionValue" = "defaultCommission",
    "defaultCommissionType"  = 'FIXED'
WHERE "defaultCommission" IS NOT NULL;

ALTER TABLE "Supplier" DROP COLUMN "defaultCommission";
