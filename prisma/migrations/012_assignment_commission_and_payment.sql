-- Phase 2 of the suppliers overhaul.
-- Adds per-assignment commission, payment terms, and a paid-at marker.
-- All four columns are nullable — when commission* is null on an
-- assignment, the supplier's defaultCommission* values are the fallback
-- (resolved at read time in app/actions/supplier-assignments.ts).

ALTER TABLE "SupplierTaskAssignment"
  ADD COLUMN "commissionType"   "SupplierCommissionType",
  ADD COLUMN "commissionValue"  DECIMAL(10, 2),
  ADD COLUMN "paymentTerms"     TEXT,
  ADD COLUMN "commissionPaidAt" TIMESTAMP(3);

-- Helps the phase-4 dashboard query (sum commissions earned vs paid
-- within a period without scanning the whole table).
CREATE INDEX "SupplierTaskAssignment_commissionPaidAt_idx"
  ON "SupplierTaskAssignment" ("commissionPaidAt");
