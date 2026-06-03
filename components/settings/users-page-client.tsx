"use client";

import { useState, useTransition } from "react";
import { KeyRound, Pencil, Plus, Power, Loader2 } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { toggleUserActive } from "@/app/actions/users";
import { UserFormDialog } from "./user-form-dialog";
import { ResetPasswordDialog } from "./reset-password-dialog";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "מנהל",
  EMPLOYEE: "עובד",
  CONTRACTOR: "קבלן"
};

const ROLE_VARIANT: Record<UserRole, "warning" | "info" | "muted"> = {
  ADMIN: "warning",
  EMPLOYEE: "info",
  CONTRACTOR: "muted"
};

export function UsersPageClient({
  users,
  currentUserId
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [mode, setMode] = useState<
    | { kind: "create" }
    | {
        kind: "update";
        userId: string;
        initial: { name: string; email: string; phone: string | null; role: UserRole };
      }
    | null
  >(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Separate from `mode` so the row keeps showing while the reset dialog
  // is open — admin can edit and reset without re-clicking the row.
  const [resetTarget, setResetTarget] = useState<{ id: string; name: string } | null>(
    null
  );

  const handleToggleActive = (u: UserRow) => {
    const verb = u.isActive ? "להשבית" : "להפעיל מחדש";
    if (!window.confirm(`האם ${verb} את "${u.name}"?`)) return;
    setTogglingId(u.id);
    startTransition(async () => {
      try {
        await toggleUserActive(u.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setTogglingId(null);
      }
    });
  };

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          משתמשים ({users.length})
        </h2>
        <button
          type="button"
          onClick={() => setMode({ kind: "create" })}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          משתמש חדש
        </button>
      </div>

      <div className="md:hidden flex flex-col gap-2 p-2">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const isToggling = togglingId === u.id && pending;
          return (
            <div
              key={u.id}
              className={cn(
                "flex flex-col gap-1.5 rounded-md border bg-card p-3 shadow-sm",
                !u.isActive && "opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-medium", !u.isActive && "line-through")}>
                    {u.name}
                    {isSelf && (
                      <span className="ms-1 text-[10px] text-muted-foreground">(אתה)</span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {u.email}
                  </div>
                  {u.phone && (
                    <div className="truncate text-[10px] tabular-nums text-muted-foreground">
                      {u.phone}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                  {u.isActive ? (
                    <Badge variant="success">פעיל</Badge>
                  ) : (
                    <Badge variant="muted">מושבת</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setMode({
                      kind: "update",
                      userId: u.id,
                      initial: {
                        name: u.name,
                        email: u.email,
                        phone: u.phone,
                        role: u.role
                      }
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-[11px] hover:bg-accent"
                >
                  <Pencil className="size-3" />
                  ערוך
                </button>
                {!isSelf && (
                  <>
                    <button
                      type="button"
                      onClick={() => setResetTarget({ id: u.id, name: u.name })}
                      className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      <KeyRound className="size-3" />
                      אפס סיסמה
                    </button>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleActive(u)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium",
                        u.isActive
                          ? "border-red-500/50 bg-red-500/10 text-red-800 hover:bg-red-500/20 dark:text-red-300"
                          : "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300",
                        isToggling && "opacity-50"
                      )}
                    >
                      {isToggling ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Power className="size-3" />
                      )}
                      {u.isActive ? "השבת" : "הפעל"}
                    </button>
                  </>
                )}
              </div>
              <div className="text-[10px] tabular-nums text-muted-foreground">
                נוסף {formatDateTime(u.createdAt)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th>אימייל</th>
            <th className="w-24">תפקיד</th>
            <th className="w-24">סטטוס</th>
            <th className="w-32">נוסף</th>
            <th className="w-32">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            const isToggling = togglingId === u.id && pending;
            return (
              <tr
                key={u.id}
                className={cn("hover:bg-muted/30", !u.isActive && "text-muted-foreground")}
              >
                <td>
                  <span className={cn("font-medium", !u.isActive && "line-through")}>
                    {u.name}
                  </span>
                  {isSelf && (
                    <span className="ms-1 text-[10px] text-muted-foreground">(אתה)</span>
                  )}
                </td>
                <td className="text-xs">{u.email}</td>
                <td>
                  <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                </td>
                <td>
                  {u.isActive ? (
                    <Badge variant="success">פעיל</Badge>
                  ) : (
                    <Badge variant="muted">מושבת</Badge>
                  )}
                </td>
                <td className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDateTime(u.createdAt)}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setMode({
                          kind: "update",
                          userId: u.id,
                          initial: {
                            name: u.name,
                            email: u.email,
                            phone: u.phone,
                            role: u.role
                          }
                        })
                      }
                      className="inline-flex items-center gap-1 rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-accent"
                    >
                      <Pencil className="size-2.5" />
                      ערוך
                    </button>
                    {!isSelf && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setResetTarget({ id: u.id, name: u.name })
                          }
                          className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-300"
                          title="איפוס סיסמה למשתמש זה"
                        >
                          <KeyRound className="size-2.5" />
                          אפס סיסמה
                        </button>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() => handleToggleActive(u)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            u.isActive
                              ? "border-red-500/50 bg-red-500/10 text-red-800 hover:bg-red-500/20 dark:text-red-300"
                              : "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300",
                            isToggling && "opacity-50"
                          )}
                        >
                          {isToggling ? (
                            <Loader2 className="size-2.5 animate-spin" />
                          ) : (
                            <Power className="size-2.5" />
                          )}
                          {u.isActive ? "השבת" : "הפעל"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      {mode && (
        <UserFormDialog
          key={mode.kind === "update" ? `edit-${mode.userId}` : "create"}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          userId={resetTarget.id}
          userName={resetTarget.name}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
