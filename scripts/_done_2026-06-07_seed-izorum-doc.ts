// One-shot — uploads the איזורם service catalog PDF to Supabase Storage
// and creates the SupplierDocument row. Mirrors the same path/audit logic
// as app/actions/supplier-documents.ts so the resulting row is
// indistinguishable from a UI upload. Renamed with the _done_ prefix
// after execution (project convention — see scripts/_done_2026-05-31_*).

import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { AuditAction, PrismaClient } from "@prisma/client";
import {
  buildSupplierDocumentStoragePath,
  uploadToStorage
} from "../lib/supabase-storage";
import { AuditEntity, logAudit } from "../lib/audit";

config();

const SUPPLIER_ID = "cmq2y8w6d0005l50430hggcav"; // איזורם
const FILE_PATH = "C:\\Users\\itzik\\AppData\\Local\\Temp\\izorum-services.pdf";
const FILE_NAME = "איזורם - מפרט שירותים.pdf";
const DESCRIPTION = "מפרט שירותים";
const MIME = "application/pdf";

async function main() {
  const prisma = new PrismaClient();
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: SUPPLIER_ID },
      select: { id: true, name: true }
    });
    if (!supplier) throw new Error(`Supplier ${SUPPLIER_ID} not found`);

    // Pick an ADMIN user to attribute the upload to so the audit row has
    // a non-null userId — matches what a real UI upload would produce.
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, name: true }
    });
    if (!admin) throw new Error("No active ADMIN user found");

    const buffer = readFileSync(FILE_PATH);
    const storagePath = buildSupplierDocumentStoragePath(SUPPLIER_ID, FILE_NAME);
    await uploadToStorage(buffer, storagePath, MIME);

    await prisma.$transaction(async (tx) => {
      const doc = await tx.supplierDocument.create({
        data: {
          supplierId: SUPPLIER_ID,
          fileName: FILE_NAME,
          fileUrl: storagePath,
          mimeType: MIME,
          sizeBytes: buffer.byteLength,
          description: DESCRIPTION,
          uploadedById: admin.id
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER_DOCUMENT,
        entityId: doc.id,
        action: AuditAction.CREATE,
        newValue: {
          supplierId: SUPPLIER_ID,
          supplierName: supplier.name,
          fileName: FILE_NAME,
          mimeType: MIME,
          sizeBytes: buffer.byteLength,
          description: DESCRIPTION,
          source: "one_shot_script"
        },
        userId: admin.id
      });
      // eslint-disable-next-line no-console
      console.log(`Uploaded ${FILE_NAME} → ${storagePath} (doc ${doc.id})`);
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
