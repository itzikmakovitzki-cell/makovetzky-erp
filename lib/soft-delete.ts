// Conventional helpers around the `deletedAt` soft-delete flag used by
// Client, MasterDeal, Permit, Task, and Document (see schema.prisma).
//
// Active records have `deletedAt = null`. The recycle bin lists rows where
// `deletedAt != null`. We never filter on `deletedAt` in audit-log name
// resolution — we still want to show "Task X was deleted" with its name.

// The 5 entity types soft-deletes apply to. Used as the `kind` in the recycle
// bin server actions to dispatch to the right Prisma model.
export const TRASHABLE_KINDS = [
  "client",
  "masterDeal",
  "permit",
  "task",
  "document"
] as const;

export type TrashableKind = (typeof TRASHABLE_KINDS)[number];

export function isTrashableKind(value: string): value is TrashableKind {
  return (TRASHABLE_KINDS as readonly string[]).includes(value);
}
