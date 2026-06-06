import { AuditAction, Prisma, type PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

// Common entityType values — keep as constants so we get autocomplete,
// but the column is a free String so new types can be added without migrations.
export const AuditEntity = {
  CLIENT: "CLIENT",
  MASTER_DEAL: "MASTER_DEAL",
  PERMIT: "PERMIT",
  BUILDING: "BUILDING",
  TASK: "TASK",
  TASK_DEPENDENCY: "TASK_DEPENDENCY",
  DOCUMENT: "DOCUMENT",
  NOTE: "NOTE",
  MILESTONE: "MILESTONE",
  SUPPLIER: "SUPPLIER",
  SUPPLIER_ASSIGNMENT: "SUPPLIER_ASSIGNMENT",
  PENDING_DOCUMENT: "PENDING_DOCUMENT",
  USER: "USER",
  AUTHORITY: "AUTHORITY",
  AUTHORITY_WIKI: "AUTHORITY_WIKI",
  BUILDING_TYPE: "BUILDING_TYPE",
  TASK_TEMPLATE: "TASK_TEMPLATE",
  TASK_TEMPLATE_DEPENDENCY: "TASK_TEMPLATE_DEPENDENCY",
  MAGIC_LINK: "MAGIC_LINK",
  PORTAL_ACCESS: "PORTAL_ACCESS",
  PROPOSAL: "PROPOSAL",
  DEAL_MILESTONE: "DEAL_MILESTONE",
  AUTHORITY_SUBMISSION: "AUTHORITY_SUBMISSION",
  PARTNER_CATEGORY: "PARTNER_CATEGORY",
  // Block 33 — per-permit contacts directory.
  PROJECT_CONTACT: "PROJECT_CONTACT"
} as const;

export type AuditEntityValue = (typeof AuditEntity)[keyof typeof AuditEntity] | (string & {});

// Always invoke this inside the same prisma.$transaction as the data mutation
// so the audit row and the state change commit atomically.
export async function logAudit(
  tx: TxClient,
  params: {
    entityType: AuditEntityValue;
    entityId: string;
    action: AuditAction;
    oldValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    userId?: string | null;
  }
) {
  return tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValue: params.oldValue,
      newValue: params.newValue,
      userId: params.userId ?? null
    }
  });
}
