-- Block 38 — files attached to a Supplier (service catalog / capabilities
-- PDF / contract). Distinct from "Document" — that model is hard-tied to a
-- permit (work product); SupplierDocument is metadata about the supplier
-- itself. Hard delete on supplier removal; storage cleanup runs in the
-- application transaction (see app/actions/supplier-documents.ts).

CREATE TABLE "SupplierDocument" (
    "id"           TEXT         NOT NULL,
    "supplierId"   TEXT         NOT NULL,
    "fileName"     TEXT         NOT NULL,
    "fileUrl"      TEXT         NOT NULL,
    "mimeType"     TEXT,
    "sizeBytes"    INTEGER,
    "description"  TEXT,
    "uploadedById" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierDocument"
  ADD CONSTRAINT "SupplierDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SupplierDocument_supplierId_createdAt_idx"
  ON "SupplierDocument" ("supplierId", "createdAt");
