-- Default assignee on TaskTemplate. When tasks are generated from a template
-- (createProject / addPermitToDeal), the new task inherits this user as its
-- assignee. ON DELETE SET NULL keeps templates intact when a user is removed.
-- Pure addition — no backfill, no data loss, fully idempotent.

BEGIN;

ALTER TABLE "TaskTemplate"
  ADD COLUMN IF NOT EXISTS "defaultAssigneeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'TaskTemplate'
      AND constraint_name = 'TaskTemplate_defaultAssigneeId_fkey'
  ) THEN
    ALTER TABLE "TaskTemplate"
      ADD CONSTRAINT "TaskTemplate_defaultAssigneeId_fkey"
      FOREIGN KEY ("defaultAssigneeId")
      REFERENCES "User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TaskTemplate_defaultAssigneeId_idx"
  ON "TaskTemplate"("defaultAssigneeId");

COMMIT;
