-- V2 toggle: are the milestone amounts gross (VAT included) or net (VAT
-- added). Default TRUE preserves the original V2 hard-coded label ("כולל
-- מע״מ"), so the handful of V2 proposals created in the cutover window
-- read identically. Forward, the admin picks per-quote from the form.

ALTER TABLE "Proposal"
  ADD COLUMN "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT TRUE;
