"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import type { MilestoneStatus } from "@prisma/client";
import { updateDealMilestoneStatus } from "@/app/actions/deal-milestones";
import { MILESTONE_STATUS_LABEL } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

// Pill-shaped <select> for a single DealMilestone row, mirrors the
// MasterDealStatusControl pattern — the badge IS the edit affordance.
// Admin-only (wrapping page only renders this for ADMIN sessions); the
// server action re-verifies.
//
// PAID has a soft destructive footprint: it stamps paidAt and is the
// signal a customer balance just got collected. We surface a confirm()
// when flipping INTO PAID, but not when flipping OUT (admin might be
// correcting a misclick and we don't want to nag them twice).

const STATUS_ORDER: MilestoneStatus[] = ["PENDING", "DUE", "PAID"];

function statusClass(status: MilestoneStatus): string {
  switch (status) {
    case "PENDING":
      return "border-foreground/30 bg-background text-foreground";
    case "DUE":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "PAID":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
}

export function DealMilestoneStatusControl({
  milestoneId,
  currentStatus,
  amountLabel
}: {
  milestoneId: string;
  currentStatus: MilestoneStatus;
  amountLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="relative inline-flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "relative inline-flex items-center",
          pending && "opacity-50"
        )}
      >
        <select
          disabled={pending}
          value={currentStatus}
          onChange={(e) => {
            const next = e.target.value as MilestoneStatus;
            if (next === currentStatus) return;
            if (next === "PAID") {
              if (
                !window.confirm(
                  `לסמן את אבן הדרך הזו כשולמה (${amountLabel})?\n\nתאריך התשלום יוטבע ביומן הביקורת.`
                )
              ) {
                e.target.value = currentStatus;
                return;
              }
            }
            setError(null);
            startTransition(async () => {
              const res = await updateDealMilestoneStatus(
                milestoneId,
                next,
                currentStatus
              );
              if (!res.ok) {
                setError(res.error);
                e.target.value = currentStatus;
              }
            });
          }}
          className={cn(
            "appearance-none rounded border ps-2 pe-5 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring",
            statusClass(currentStatus)
          )}
          aria-label="שינוי סטטוס אבן דרך"
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {MILESTONE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute end-1 top-1/2 -translate-y-1/2 size-2.5 opacity-60" />
      </span>
      {error && (
        <span className="text-[9.5px] text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
