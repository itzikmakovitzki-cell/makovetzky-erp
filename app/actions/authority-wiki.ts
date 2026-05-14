"use server";

import { revalidatePath } from "next/cache";
import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/current-user";
import { AuditEntity, logAudit } from "@/lib/audit";

// Internal — "use server" files can only export async functions.
type FormState = { error: string | null; ok: boolean };

const MAX_CONTENT_LENGTH = 20000;
const PREVIEW_LENGTH = 80;

function preview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_LENGTH) return trimmed;
  return trimmed.slice(0, PREVIEW_LENGTH).trimEnd();
}

export async function submitWikiEntry(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  // ADMIN gate — wiki entries are managerial knowledge.
  let me;
  try {
    me = await requireRole(["ADMIN"]);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "אין הרשאה לפעולה זו",
      ok: false
    };
  }

  try {
    const kind = String(formData.get("kind") || "");
    const authorityId = String(formData.get("authorityId") || "");
    const title = String(formData.get("title") || "").trim();
    const category = String(formData.get("category") || "").trim() || null;
    const contentMd = String(formData.get("contentMd") || "").trim();

    if (!authorityId) return { error: "חסר מזהה רשות", ok: false };
    if (!title) return { error: "כותרת חובה", ok: false };
    if (!contentMd) return { error: "תוכן חובה", ok: false };
    if (contentMd.length > MAX_CONTENT_LENGTH) {
      return { error: `תוכן ארוך מ-${MAX_CONTENT_LENGTH} תווים`, ok: false };
    }

    const authority = await prisma.authority.findUnique({
      where: { id: authorityId },
      select: { id: true, name: true }
    });
    if (!authority) return { error: "הרשות לא נמצאה", ok: false };

    if (kind === "create") {
      await prisma.$transaction(async (tx) => {
        const entry = await tx.authorityWikiEntry.create({
          data: { authorityId, title, category, contentMd }
        });
        await logAudit(tx, {
          entityType: AuditEntity.AUTHORITY_WIKI,
          entityId: entry.id,
          action: AuditAction.CREATE,
          newValue: {
            authorityId,
            authorityName: authority.name,
            title,
            category,
            contentPreview: preview(contentMd)
          },
          userId: me.id
        });
      });
      revalidatePath(`/settings/authorities/${authorityId}`);
      revalidatePath("/settings/authorities");
      return { error: null, ok: true };
    }

    if (kind === "update") {
      const id = String(formData.get("id") || "");
      if (!id) return { error: "חסר מזהה", ok: false };
      const existing = await prisma.authorityWikiEntry.findUnique({
        where: { id },
        select: {
          id: true,
          authorityId: true,
          title: true,
          category: true,
          contentMd: true
        }
      });
      if (!existing) return { error: "הרשומה לא נמצאה", ok: false };
      if (existing.authorityId !== authorityId) {
        return { error: "אי-התאמה בין רשות לרשומה", ok: false };
      }

      await prisma.$transaction(async (tx) => {
        await tx.authorityWikiEntry.update({
          where: { id },
          data: { title, category, contentMd }
        });
        await logAudit(tx, {
          entityType: AuditEntity.AUTHORITY_WIKI,
          entityId: id,
          action: AuditAction.UPDATE,
          oldValue: {
            title: existing.title,
            category: existing.category,
            contentPreview: preview(existing.contentMd)
          },
          newValue: {
            title,
            category,
            contentPreview: preview(contentMd)
          },
          userId: me.id
        });
      });
      revalidatePath(`/settings/authorities/${authorityId}`);
      return { error: null, ok: true };
    }

    return { error: "פעולה לא חוקית", ok: false };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "שגיאה לא צפויה",
      ok: false
    };
  }
}

export async function deleteWikiEntry(id: string): Promise<void> {
  const me = await requireRole(["ADMIN"]);
  const entry = await prisma.authorityWikiEntry.findUnique({
    where: { id },
    select: { id: true, authorityId: true, title: true, contentMd: true }
  });
  if (!entry) throw new Error("הרשומה לא נמצאה");

  await prisma.$transaction(async (tx) => {
    await tx.authorityWikiEntry.delete({ where: { id } });
    await logAudit(tx, {
      entityType: AuditEntity.AUTHORITY_WIKI,
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: {
        title: entry.title,
        contentPreview: preview(entry.contentMd)
      },
      userId: me.id
    });
  });

  revalidatePath(`/settings/authorities/${entry.authorityId}`);
  revalidatePath("/settings/authorities");
}
