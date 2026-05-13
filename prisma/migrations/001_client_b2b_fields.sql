-- Block 7a: Strict B2B Client fields
-- Apply with: psql "$DATABASE_URL" -f prisma/migrations/001_client_b2b_fields.sql
--          OR: npx prisma db execute --file prisma/migrations/001_client_b2b_fields.sql --schema prisma/schema.prisma
-- After applying: run `npx prisma generate` to refresh the Prisma Client types.

BEGIN;

-- 1. New nullable column for ח.פ.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "hp" TEXT;

-- 2. Backfill companyName from legacy `name` where it's null, so the NOT NULL constraint will hold.
UPDATE "Client" SET "companyName" = "name" WHERE "companyName" IS NULL;

-- 3. Rename primaryContactName -> contactName (preserves existing data).
ALTER TABLE "Client" RENAME COLUMN "primaryContactName" TO "contactName";

-- 4. Backfill contactName from companyName for legacy rows that left contact blank.
UPDATE "Client" SET "contactName" = "companyName" WHERE "contactName" IS NULL;

-- 5. Backfill phone with empty string for legacy rows (admin will fix in UI).
UPDATE "Client" SET "phone" = '' WHERE "phone" IS NULL;

-- 6. Drop the legacy `name` field — companyName is now canonical.
DROP INDEX IF EXISTS "Client_name_idx";
ALTER TABLE "Client" DROP COLUMN "name";

-- 7. Tighten NOT NULL on the strict B2B fields.
ALTER TABLE "Client" ALTER COLUMN "companyName" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "contactName" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "phone" SET NOT NULL;

-- 8. Replace the dropped index.
CREATE INDEX IF NOT EXISTS "Client_companyName_idx" ON "Client"("companyName");

COMMIT;
