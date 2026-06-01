-- Block 27 phase 4 (PR #42) made SupplierTaskAssignment.commissionPaidAt the
-- source of truth for "paid commissions" and built the /finances/supplier-
-- commissions dashboard on top of it. The older monthly-report model has
-- never had a UI and is now schema-dead. Drop it to keep the model index
-- honest.

DROP TABLE "SupplierCommissionReport";
DROP TYPE "CommissionReportStatus";
