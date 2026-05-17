import type {
  TaskStatus,
  TaskResponsibility,
  PermitStatus,
  MilestoneStatus,
  AuditAction,
  SupplierAssignmentStatus,
  MasterDealStatus
} from "@prisma/client";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info" | "muted" | "outline";

export const ACTION_LABEL: Record<AuditAction, string> = {
  CREATE: "יצירה",
  UPDATE: "עדכון",
  DELETE: "מחיקה",
  STATUS_CHANGE: "שינוי סטטוס",
  ASSIGN: "שיוך",
  DEPENDENCY_OVERRIDE: "עקיפת תלות",
  APPROVE: "אישור",
  REJECT: "דחייה"
};

export const ACTION_VARIANT: Record<AuditAction, BadgeVariant> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "destructive",
  STATUS_CHANGE: "info",
  ASSIGN: "default",
  DEPENDENCY_OVERRIDE: "warning",
  APPROVE: "success",
  REJECT: "destructive"
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: "פתוח",
  IN_PROGRESS: "בתהליך",
  AWAITING_AUTHORITY: "ממתין לרשות",
  COMPLETED: "הושלם",
  BLOCKED: "חסום"
};

export const TASK_STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = {
  OPEN: "outline",
  IN_PROGRESS: "info",
  AWAITING_AUTHORITY: "warning",
  COMPLETED: "success",
  BLOCKED: "muted"
};

export const TASK_RESPONSIBILITY_LABEL: Record<TaskResponsibility, string> = {
  INTERNAL: "הבית",
  CLIENT: "לקוח",
  CONTRACTOR: "קבלן",
  AUTHORITY: "רשות"
};

export const TASK_RESPONSIBILITY_VARIANT: Record<TaskResponsibility, BadgeVariant> = {
  INTERNAL: "muted",
  CLIENT: "info",
  CONTRACTOR: "warning",
  AUTHORITY: "default"
};

// Reverse map for CSV import (Hebrew label → enum value).
export const TASK_RESPONSIBILITY_HE_TO_ENUM: Record<string, TaskResponsibility> = {
  הבית: "INTERNAL",
  לקוח: "CLIENT",
  קבלן: "CONTRACTOR",
  רשות: "AUTHORITY"
};

export const PERMIT_STATUS_LABEL: Record<PermitStatus, string> = {
  DRAFT: "טיוטה",
  IN_PROGRESS: "בעבודה",
  AWAITING_AUTHORITY: "ממתין לרשות",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל"
};

export const PERMIT_STATUS_VARIANT: Record<PermitStatus, BadgeVariant> = {
  DRAFT: "muted",
  IN_PROGRESS: "info",
  AWAITING_AUTHORITY: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive"
};

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  PENDING: "ממתין",
  DUE: "מועד הגיע",
  PAID: "שולם"
};

export const MILESTONE_STATUS_VARIANT: Record<MilestoneStatus, BadgeVariant> = {
  PENDING: "muted",
  DUE: "warning",
  PAID: "success"
};

export const SUPPLIER_ASSIGNMENT_STATUS_LABEL: Record<SupplierAssignmentStatus, string> = {
  OPEN: "פתוח",
  IN_PROGRESS: "בתהליך",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל"
};

export const SUPPLIER_ASSIGNMENT_STATUS_VARIANT: Record<SupplierAssignmentStatus, BadgeVariant> = {
  OPEN: "outline",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "muted"
};

export const MASTER_DEAL_STATUS_LABEL: Record<MasterDealStatus, string> = {
  ACTIVE: "פעילה",
  ON_HOLD: "מושהית",
  COMPLETED: "הושלמה",
  CANCELLED: "בוטלה"
};

export const MASTER_DEAL_STATUS_VARIANT: Record<MasterDealStatus, BadgeVariant> = {
  ACTIVE: "info",
  ON_HOLD: "warning",
  COMPLETED: "success",
  CANCELLED: "destructive"
};
