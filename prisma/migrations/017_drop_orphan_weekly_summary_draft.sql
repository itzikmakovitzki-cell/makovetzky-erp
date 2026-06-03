-- WeeklySummaryDraft was scaffolded as part of the early "PM weekly
-- recap" idea but never grew a UI or a writer. The model still showed
-- up in the schema with reverse relations on Permit and User but no
-- code path actually reads or writes it. Drop it so the schema reflects
-- reality. Same pattern as migration 013 (SupplierCommissionReport).

DROP TABLE IF EXISTS "WeeklySummaryDraft";
