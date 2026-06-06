"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Block 33 — Project Contacts Directory ("ספר טלפונים").
//
// Role rules (deliberate — see migration 024 comment):
//   * ADMIN / EMPLOYEE  — full CRUD via back-office permit dashboard.
//   * CONTRACTOR (portal) — INSERT only, scoped by PortalAccess to the
//     permit's client. Edits + deletes must go through a PM so a client
//     can't accidentally wipe the team list.
//
// Every mutation lives inside a single prisma.$transaction with logAudit
// so the directory state and the audit row commit atomically.

export type ContactFormState = { error: string | null; ok: boolean };
type DeleteResult = { ok: true } | { ok: false; error: string };

function readContactForm(formData: FormData): {
  permitId: string;
  name: string;
  role: string;
  phone: string;
  email: string | null;
  notes: string | null;
} {
  return {
    permitId: String(formData.get("permitId") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    role: String(formData.get("role") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    email: String(formData.get("email") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null
  };
}

// Lightweight Hebrew validator — the field-level UI catches most of this
// before submit, but we re-verify so direct action calls (or a stale form)
// don't slip past with empties.
function validateRequired(fields: { name: string; role: string; phone: string }): string | null {
  if (!fields.name) return "שם איש הקשר חובה";
  if (!fields.role) return "תפקיד חובה";
  if (!fields.phone) return "טלפון חובה";
  return null;
}

// PortalAccess gate for CONTRACTOR-role callers. Mirrors what the rest of
// the portal write-paths do (assertPortalAccessToPermit in lib/portal-access).
async function assertCanWriteToPermit(
  user: { id: string; role: string },
  permitId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permit = await prisma.permit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true, masterDeal: { select: { clientId: true } } }
  });
  if (!permit) return { ok: false, error: "ההיתר לא נמצא" };

  if (user.role === "ADMIN" || user.role === "EMPLOYEE") return { ok: true };
  if (user.role === "CONTRACTOR") {
    const granted = await prisma.portalAccess.findFirst({
      where: { userId: user.id, clientId: permit.masterDeal.clientId },
      select: { id: true }
    });
    if (!granted) return { ok: false, error: "אין לך גישה להיתר זה" };
    return { ok: true };
  }
  return { ok: false, error: "אין הרשאה לפעולה זו" };
}

// --- Create -----------------------------------------------------------

export async function submitProjectContact(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  try {
    // ADMIN, EMPLOYEE, CONTRACTOR allowed — the per-permit access check
    // below is what actually gates CONTRACTOR.
    const me = await getCurrentUser();
    const fields = readContactForm(formData);
    if (!fields.permitId) return { error: "חסר מזהה היתר", ok: false };

    const access = await assertCanWriteToPermit(me, fields.permitId);
    if (!access.ok) return { error: access.error, ok: false };

    const err = validateRequired(fields);
    if (err) return { error: err, ok: false };

    await prisma.$transaction(async (tx) => {
      const c = await tx.projectContact.create({
        data: {
          permitId: fields.permitId,
          name: fields.name,
          role: fields.role,
          phone: fields.phone,
          email: fields.email,
          notes: fields.notes,
          createdById: me.id
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROJECT_CONTACT,
        entityId: c.id,
        action: AuditAction.CREATE,
        newValue: {
          permitId: fields.permitId,
          name: fields.name,
          role: fields.role,
          phone: fields.phone,
          email: fields.email,
          notes: fields.notes,
          source: me.role === "CONTRACTOR" ? "portal" : "back_office"
        },
        userId: me.id
      });
    });

    revalidatePath(`/permits/${fields.permitId}/contacts`);
    revalidatePath(`/portal/permit/${fields.permitId}`);
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// --- Update (back-office only) ----------------------------------------

export async function updateProjectContact(
  _prev: ContactFormState,
  formData: FormData
): Promise<ContactFormState> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const id = String(formData.get("contactId") || "").trim();
    if (!id) return { error: "חסר מזהה איש קשר", ok: false };

    const existing = await prisma.projectContact.findUnique({
      where: { id },
      select: {
        id: true,
        permitId: true,
        name: true,
        role: true,
        phone: true,
        email: true,
        notes: true
      }
    });
    if (!existing) return { error: "איש הקשר לא נמצא", ok: false };

    const fields = readContactForm(formData);
    const err = validateRequired(fields);
    if (err) return { error: err, ok: false };

    await prisma.$transaction(async (tx) => {
      await tx.projectContact.update({
        where: { id },
        data: {
          name: fields.name,
          role: fields.role,
          phone: fields.phone,
          email: fields.email,
          notes: fields.notes
        }
      });
      await logAudit(tx, {
        entityType: AuditEntity.PROJECT_CONTACT,
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: {
          name: existing.name,
          role: existing.role,
          phone: existing.phone,
          email: existing.email,
          notes: existing.notes
        },
        newValue: {
          name: fields.name,
          role: fields.role,
          phone: fields.phone,
          email: fields.email,
          notes: fields.notes
        },
        userId: me.id
      });
    });

    revalidatePath(`/permits/${existing.permitId}/contacts`);
    revalidatePath(`/portal/permit/${existing.permitId}`);
    return { error: null, ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "שגיאה לא צפויה", ok: false };
  }
}

// --- Delete (back-office only) ----------------------------------------

export async function deleteProjectContact(contactId: string): Promise<DeleteResult> {
  try {
    const me = await requireRole(["ADMIN", "EMPLOYEE"]);
    const existing = await prisma.projectContact.findUnique({
      where: { id: contactId },
      select: { id: true, permitId: true, name: true, role: true }
    });
    if (!existing) return { ok: false, error: "איש הקשר לא נמצא" };

    await prisma.$transaction(async (tx) => {
      await tx.projectContact.delete({ where: { id: contactId } });
      await logAudit(tx, {
        entityType: AuditEntity.PROJECT_CONTACT,
        entityId: contactId,
        action: AuditAction.DELETE,
        oldValue: { name: existing.name, role: existing.role },
        userId: me.id
      });
    });

    revalidatePath(`/permits/${existing.permitId}/contacts`);
    revalidatePath(`/portal/permit/${existing.permitId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "מחיקת איש הקשר נכשלה"
    };
  }
}
