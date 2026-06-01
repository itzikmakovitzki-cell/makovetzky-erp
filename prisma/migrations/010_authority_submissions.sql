-- Block 26: per-(permit, category) "authority submission" lifecycle.
-- Tracks the PM workflow: PREPARING → SUBMITTED → APPROVED / REJECTED.
-- Side-effect on SUBMITTED transition (applied in the server action, not at
-- the DB layer): all category tasks in OPEN/IN_PROGRESS flip to
-- AWAITING_AUTHORITY + frozen=true.

CREATE TYPE "AuthoritySubmissionStatus" AS ENUM ('PREPARING', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "AuthoritySubmission" (
    "id"            TEXT NOT NULL,
    "permitId"      TEXT NOT NULL,
    "category"      TEXT NOT NULL,
    "status"        "AuthoritySubmissionStatus" NOT NULL DEFAULT 'PREPARING',
    "submittedAt"   TIMESTAMP(3),
    "decidedAt"     TIMESTAMP(3),
    "decisionNotes" TEXT,
    "submittedById" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthoritySubmission_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuthoritySubmission"
    ADD CONSTRAINT "AuthoritySubmission_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthoritySubmission"
    ADD CONSTRAINT "AuthoritySubmission_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "AuthoritySubmission_permitId_category_key"
    ON "AuthoritySubmission" ("permitId", "category");

CREATE INDEX "AuthoritySubmission_permitId_idx"
    ON "AuthoritySubmission" ("permitId");

CREATE INDEX "AuthoritySubmission_status_idx"
    ON "AuthoritySubmission" ("status");
