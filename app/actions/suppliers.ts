"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

export type SupplierFormState = { error: string | null; ok: boolean };

// Create a supplier. ADMIN-only, audit-logged. Supplier.name has no unique
// constraint (duplicates are allowed by design), so no P2002 handling needed.
export async function submitSupplier(
  _prev: SupplierFormState,
  formData: FormData
): Promise<SupplierFormState> {
  try {
    const me = await requireRole(["ADMIN"]);

    const name = String(formData.get("name") || "").trim();
    const type = String(formData.get("type") || "").trim() || null;
    const contactName = String(formData.get("contactName") || "").trim() || null;
    const phone = String(formData.get("phone") || "").trim() || null;
    const email = String(formData.get("email") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;
    const commissionRaw = String(formData.get("defaultCommission") || "").trim();

    if (!name) return { error: "שם הספק חובה", ok: false };

    let defaultCommission: string | null = null;
    if (commissionRaw) {
      const n = Number(commissionRaw);
      if (Number.isNaN(n) || n < 0) {
        return { error: "עמלת ברירת מחדל חייבת להיות מספר חיובי", ok: false };
      }
      defaultCommission = n.toFixed(2);
    }

    await prisma.$transaction(async (tx) => {
      const s = await tx.supplier.create({
        data: { name, type, contactName, phone, email, notes, defaultCommission }
      });
      await logAudit(tx, {
        entityType: AuditEntity.SUPPLIER,
        entityId: s.id,
        action: AuditAction.CREATE,
        newValue: { name, type, contactName, phone, email, defaultCommission },
        userId: me.id
      });
    });

    revalidatePath("/suppliers");
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}
