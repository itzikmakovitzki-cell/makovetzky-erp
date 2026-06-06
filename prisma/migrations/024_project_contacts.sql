-- Block 33 — Project Contacts Directory ("ספר טלפונים").
-- One row per professional (architect / supervisor / plumber / etc.)
-- associated with a single permit. Surfaced in both the back-office
-- permit dashboard ("Contacts" tab) and the client portal so PMs can
-- chase signatures and clients can reach their team without hunting
-- through email threads.
--
-- Portal users (CONTRACTOR role) can INSERT — crowdsourced data
-- collection. UPDATE / DELETE are guarded at the application layer to
-- ADMIN / EMPLOYEE so a client can't accidentally wipe the directory.

CREATE TABLE "ProjectContact" (
    "id"          TEXT         NOT NULL,
    "permitId"    TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "role"        TEXT         NOT NULL,
    "phone"       TEXT         NOT NULL,
    "email"       TEXT,
    "notes"       TEXT,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectContact_pkey" PRIMARY KEY ("id")
);

-- Same cascade rules the rest of the permit children use (Block 20):
-- deleting a permit cleans the directory too. createdBy SETs NULL so
-- a user delete doesn't blow away the contact rows they added.
ALTER TABLE "ProjectContact"
  ADD CONSTRAINT "ProjectContact_permitId_fkey"
    FOREIGN KEY ("permitId") REFERENCES "Permit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectContact"
  ADD CONSTRAINT "ProjectContact_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Permit-level lookup ("list every contact for this permit") and
-- "what did this user add" for the audit drill-down.
CREATE INDEX "ProjectContact_permitId_idx"    ON "ProjectContact" ("permitId");
CREATE INDEX "ProjectContact_createdById_idx" ON "ProjectContact" ("createdById");
