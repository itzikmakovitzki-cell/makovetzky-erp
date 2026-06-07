"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { MasterDealStatus } from "@prisma/client";
import { updateMasterDealStatus } from "@/app/actions/master-deals";
import { MASTER_DEAL_STATUS_LABEL } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

// Inline status control for the project header, mirrors the pattern of
// TaskStatusControl on the permit page — pill-shaped <select> styled so
// the badge IS the edit affordance. Admin-only (the wrapping page only
// renders this for ADMIN sessions); server action re-verifies.
//
// CANCELLED is a destructive transition (it hides the deal from the
// default list), so we surface a confirm() before submitting.

const STATUS_ORDER: MasterDealStatus[] = [
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED"
];

function statusClass(status: MasterDealStatus): string {
  switch (status) {
    case "ACTIVE":
      return "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "ON_HOLD":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "COMPLETED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "CANCELLED":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
  }
}

export function MasterDealStatusControl({
  dealId,
  currentStatus
}: {
  dealId: string;
  currentStatus: MasterDealStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span
      className={cn(
        "relative inline-flex flex-col items-end gap-0.5",
        pending && "opacity-50"
      )}
    >
      <span className="relative inline-flex items-center">
        <select
          disabled={pending}
          value={currentStatus}
          onChange={(e) => {
            const next = e.target.value as MasterDealStatus;
            if (next === currentStatus) return;
            if (next === "CANCELLED") {
              if (
                !window.confirm(
                  "לבטל את הפרוייקט? הוא ייעלם מהרשימה הראשית. תוכל לפתוח אותו מחדש מ-הגדרות → סל המחזור או ע״י שינוי הסטטוס ידנית."
                )
              ) {
                // Revert <select> visual to currentStatus.
                e.target.value = currentStatus;
                return;
              }
            }
            setError(null);
            startTransition(async () => {
              const res = await updateMasterDealStatus(
                dealId,
                next,
                currentStatus
              );
              if (!res.ok) {
                setError(res.error);
                // Revert the visible value.
                e.target.value = currentStatus;
              }
            });
          }}
          className={cn(
            "appearance-none rounded border ps-2 pe-5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
            statusClass(currentStatus)
          )}
          aria-label="שינוי סטטוס פרוייקט"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {MASTER_DEAL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute end-1 top-1/2 -translate-y-1/2 size-3 opacity-60" />
      </span>
      {error && (
        <span className="text-[10px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
