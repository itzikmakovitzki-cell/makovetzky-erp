-- Task metadata fields: category (free text), responsibility (enum), tags (text[])
-- Adds three classification columns to both Task and TaskTemplate. Templates
-- propagate their values into newly generated tasks; existing rows stay null /
-- empty array. Pure additions — no backfill, no data loss, fully idempotent.
-- Apply BEFORE deploying the code that uses these fields, or Prisma queries
-- will fail with "column does not exist" on every read of these tables.

BEGIN;

-- Enum is created up-front (no IF NOT EXISTS in older Postgres, so guarded
-- via DO block).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskResponsibility') THEN
    CREATE TYPE "TaskResponsibility" AS ENUM ('INTERNAL', 'CLIENT', 'CONTRACTOR', 'AUTHORITY');
  END IF;
END $$;

ALTER TABLE "Task"
  ADD COLUMN IF NOT EXISTS "category"       TEXT,
  ADD COLUMN IF NOT EXISTS "responsibility" "TaskResponsibility",
  ADD COLUMN IF NOT EXISTS "tags"           TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "TaskTemplate"
  ADD COLUMN IF NOT EXISTS "category"       TEXT,
  ADD COLUMN IF NOT EXISTS "responsibility" "TaskResponsibility",
  ADD COLUMN IF NOT EXISTS "tags"           TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "Task_category_idx"               ON "Task"("category");
CREATE INDEX IF NOT EXISTS "Task_responsibility_idx"         ON "Task"("responsibility");
CREATE INDEX IF NOT EXISTS "Task_tags_idx"                   ON "Task" USING GIN ("tags");

CREATE INDEX IF NOT EXISTS "TaskTemplate_category_idx"       ON "TaskTemplate"("category");
CREATE INDEX IF NOT EXISTS "TaskTemplate_responsibility_idx" ON "TaskTemplate"("responsibility");
CREATE INDEX IF NOT EXISTS "TaskTemplate_tags_idx"           ON "TaskTemplate" USING GIN ("tags");

COMMIT;
