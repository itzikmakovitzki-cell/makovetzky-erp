"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Link2, Loader2 } from "lucide-react";
import {
  connectGroupToProject,
  type OrphanGroup
} from "@/app/actions/whatsapp-groups";
import { formatDate } from "@/lib/utils";

// Wizard for connecting a freshly-arrived "orphan" WhatsApp group to a
// project. Extracted from project-whatsapp-panel.tsx (June 2026) so the
// 712-line panel can focus on its container concerns.
//
// "Orphan" groups are rows in ProjectWhatsAppGroup with masterDealId=null
// — the green-api webhook saw a tagged message in a group but didn't know
// which project it belonged to until an admin manually picks it here.

export function ConnectGroupWizard({
  masterDealId,
  dealName,
  orphans,
  onClose
}: {
  masterDealId: string;
  dealName: string;
  orphans: OrphanGroup[];
  onClose: () => void;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const choose = (groupId: string, label: string) => {
    const proceed = window.confirm(
      `לחבר את הקבוצה "${label}" לפרויקט "${dealName}"?`
    );
    if (!proceed) return;
    setError(null);
    setPendingId(groupId);
    startTransition(async () => {
      const r = await connectGroupToProject({ groupId, masterDealId });
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-md border bg-card shadow-lg">
        <div className="border-b bg-muted/30 px-3 py-1.5">
          <h3 className="text-sm font-semibold">חבר קבוצה לפרויקט — {dealName}</h3>
        </div>
        <div className="space-y-2 px-3 py-3">
          <ol className="list-decimal space-y-1 pr-4 text-[11px] text-muted-foreground">
            <li>הוסף את מספר ה-WhatsApp של המערכת לקבוצת הפרויקט.</li>
            <li>שלח בקבוצה הודעה שמתייגת את מספר המערכת.</li>
            <li>הקבוצה תופיע ברשימה כאן בתוך מספר שניות. בחר אותה למטה.</li>
          </ol>
          <div className="border-t pt-2">
            <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              קבוצות ממתינות לקישור
            </h4>
            {orphans.length === 0 ? (
              <p className="rounded border border-dashed bg-muted/30 px-2 py-2 text-[11px] text-muted-foreground">
                אין כרגע קבוצות ממתינות. ברגע שתשלח הודעה בקבוצה עם תיוג המערכת,
                הקבוצה תופיע כאן.
              </p>
            ) : (
              <ul className="space-y-1">
                {orphans.map((g) => {
                  const label = g.groupName ?? g.groupChatId;
                  const isPending = pendingId === g.id;
                  return (
                    <li
                      key={g.id}
                      className="flex items-center justify-between gap-2 rounded border border-input bg-background px-2 py-1.5"
                    >
                      <div className="min-w-0 text-[11px]">
                        <div className="font-medium">{label}</div>
                        <div className="text-muted-foreground" dir="ltr">
                          {g.groupChatId}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          התקבלה: {formatDate(g.createdAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => choose(g.id, label)}
                        disabled={pendingId !== null}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Link2 className="size-3" />
                        )}
                        חבר
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {error && (
            <p className="inline-flex items-center gap-1 text-[11px] text-red-700">
              <AlertTriangle className="size-3" />
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
