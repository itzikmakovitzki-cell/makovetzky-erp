"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, ShieldCheck, Trash2, UserCheck } from "lucide-react";
import { revokePortalAccess } from "@/app/actions/portal-access";
import { cn } from "@/lib/utils";
import { GrantPortalAccessDialog } from "./grant-portal-access-dialog";

type ContractorUser = { id: string; name: string; email: string };

export type PortalAccessRow = {
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string; // ISO
};

export function PortalAccessSection({
  clientId,
  accesses,
  contractorCandidates
}: {
  clientId: string;
  accesses: PortalAccessRow[];
  contractorCandidates: ContractorUser[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleRevoke = (row: PortalAccessRow) => {
    if (!window.confirm(`לבטל את גישת ${row.userName} ללקוח?`)) return;
    setRevokingId(row.userId);
    startTransition(async () => {
      const res = await revokePortalAccess(clientId, row.userId);
      if (!res.ok) {
        window.alert(res.error || "שגיאה לא צפויה");
      }
      setRevokingId(null);
    });
  };

  // Hide already-granted users from the dialog's candidate list.
  const grantedIds = new Set(accesses.map((a) => a.userId));
  const dialogCandidates = contractorCandidates.filter((u) => !grantedIds.has(u.id));

  return (
    <div className="rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-1.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ShieldCheck className="size-3" />
          גישות פורטל לקבלנים ({accesses.length})
        </h2>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
        >
          <Plus className="size-3" />
          הוסף גישת קבלן
        </button>
      </div>

      {accesses.length === 0 ? (
        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
          ללקוח אין משתמשי קבלן מקושרים. הקבלן יראה בפורטל רק את המשימות ששויכו אליו אישית.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>קבלן</th>
              <th className="w-56">אימייל</th>
              <th className="w-32">קושר בתאריך</th>
              <th className="w-24">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {accesses.map((row) => {
              const isRevoking = revokingId === row.userId && pending;
              return (
                <tr key={row.userId} className="hover:bg-muted/30">
                  <td>
                    <div className="inline-flex items-center gap-1.5">
                      <UserCheck className="size-3 text-muted-foreground" />
                      <span className="font-medium">{row.userName}</span>
                    </div>
                  </td>
                  <td className="text-[11px] text-muted-foreground">{row.userEmail}</td>
                  <td className="text-[11px] tabular-nums text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRevoke(row)}
                      disabled={isRevoking}
                      title="בטל גישה"
                      className={cn(
                        "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
                        isRevoking && "cursor-not-allowed opacity-50"
                      )}
                    >
                      {isRevoking ? (
                        <Loader2 className="size-2.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-2.5" />
                      )}
                      בטל
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <GrantPortalAccessDialog
          clientId={clientId}
          candidates={dialogCandidates}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
