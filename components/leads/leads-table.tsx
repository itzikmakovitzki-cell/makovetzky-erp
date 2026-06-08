"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Building2,
  CheckCircle2,
  Hourglass,
  Loader2,
  Phone,
  Save,
  Truck,
  X
} from "lucide-react";
import type { SupplierAssignmentStatus } from "@prisma/client";
import { updateLeadStatusAndNotes } from "@/app/actions/supplier-assignments";
import { cn } from "@/lib/utils";

// Block 38 — PM Lead Tracker table. One row per partner-lead assignment.
// Status changes save the moment the dropdown changes; notes save when the
// PM clicks "שמור הערה". Both routes go through updateLeadStatusAndNotes.

export type LeadRow = {
  id: string;
  status: SupplierAssignmentStatus;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  supplier: { id: string; name: string };
  task: { id: string; name: string };
  permit: { id: string; name: string };
  client: {
    id: string;
    companyName: string;
    contactName: string;
    phone: string;
    clientType: "PRIVATE" | "BUSINESS";
  };
};

const STATUS_OPTIONS: { value: SupplierAssignmentStatus; label: string }[] = [
  { value: "OPEN", label: "פתוח" },
  { value: "IN_PROGRESS", label: "בטיפול" },
  { value: "COMPLETED", label: "הושלם" },
  { value: "CANCELLED", label: "בוטל" }
];

export function LeadsTable({ rows }: { rows: LeadRow[] }) {
  return (
    <div className="rounded-md border bg-card">
      <table>
        <thead>
          <tr>
            <th className="w-28">תאריך</th>
            <th>לקוח</th>
            <th>פרויקט</th>
            <th>ספק</th>
            <th className="w-36">סטטוס</th>
            <th>הערה</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <LeadTableRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeadTableRow({ row }: { row: LeadRow }) {
  const [status, setStatus] = useState<SupplierAssignmentStatus>(row.status);
  const [notes, setNotes] = useState<string>(row.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const noteDirty = (row.notes ?? "") !== notes;

  const save = (nextStatus: SupplierAssignmentStatus, nextNotes: string) => {
    setError(null);
    startTransition(async () => {
      const r = await updateLeadStatusAndNotes({
        assignmentId: row.id,
        status: nextStatus,
        notes: nextNotes.trim() || null
      });
      if (!r.ok) {
        setError(r.error);
        // Roll back local state so the user knows the save didn't land.
        setStatus(row.status);
        setNotes(row.notes ?? "");
      }
    });
  };

  return (
    <tr className="align-top hover:bg-muted/30">
      <td className="text-[11px] tabular-nums text-muted-foreground">
        {formatDate(row.createdAt)}
        {row.completedAt && (
          <div className="mt-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
            הושלם: {formatDate(row.completedAt)}
          </div>
        )}
      </td>
      <td>
        <Link
          href={`/clients/${row.client.id}`}
          className="inline-flex items-center gap-1 text-[12px] font-medium underline-offset-2 hover:underline"
        >
          <Building2 className="size-3 text-muted-foreground" />
          {row.client.companyName}
        </Link>
        <div className="text-[11px] text-muted-foreground">
          {row.client.contactName}{" "}
          <a
            href={`tel:${row.client.phone}`}
            className="inline-flex items-center gap-0.5 tabular-nums text-primary underline-offset-2 hover:underline"
          >
            <Phone className="size-2.5" />
            {row.client.phone}
          </a>
        </div>
        <span
          className={cn(
            "mt-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-medium",
            row.client.clientType === "PRIVATE"
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
              : "bg-sky-500/15 text-sky-800 dark:text-sky-300"
          )}
        >
          {row.client.clientType === "PRIVATE" ? "פרטי" : "עסקי"}
        </span>
      </td>
      <td className="text-[12px]">
        <Link
          href={`/permits/${row.permit.id}`}
          className="underline-offset-2 hover:underline"
        >
          {row.permit.name}
        </Link>
        <div className="text-[10.5px] text-muted-foreground">
          משימה: {row.task.name}
        </div>
      </td>
      <td className="text-[12px]">
        <Link
          href={`/suppliers?supplier=${row.supplier.id}`}
          className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
        >
          <Truck className="size-3 text-muted-foreground" />
          {row.supplier.name}
        </Link>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <select
            value={status}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as SupplierAssignmentStatus;
              setStatus(next);
              save(next, notes);
            }}
            className={cn(
              "w-full rounded border bg-background px-1.5 py-0.5 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-ring",
              statusClass(status),
              pending && "cursor-not-allowed opacity-60"
            )}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <StatusIcon status={status} />
        </div>
        {error && (
          <div className="mt-1 inline-flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-700 dark:text-red-300">
            <X className="size-2.5" />
            {error}
          </div>
        )}
      </td>
      <td>
        <div className="flex items-start gap-1.5">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערה לליד…"
            rows={2}
            className="w-full resize-y rounded border border-input bg-background px-1.5 py-1 text-[11.5px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            disabled={!noteDirty || pending}
            onClick={() => save(status, notes)}
            title="שמור הערה"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded border border-input bg-background px-1.5 py-1 text-[10.5px]",
              noteDirty && !pending
                ? "border-primary text-primary hover:bg-primary/10"
                : "text-muted-foreground"
            )}
          >
            {pending ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              <Save className="size-2.5" />
            )}
            שמור
          </button>
        </div>
      </td>
    </tr>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function statusClass(status: SupplierAssignmentStatus): string {
  switch (status) {
    case "OPEN":
      return "border-amber-400/60 bg-amber-500/10 text-amber-900 dark:text-amber-200";
    case "IN_PROGRESS":
      return "border-sky-400/60 bg-sky-500/10 text-sky-900 dark:text-sky-200";
    case "COMPLETED":
      return "border-emerald-500/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200";
    case "CANCELLED":
      return "border-input bg-muted/40 text-muted-foreground";
  }
}

function StatusIcon({ status }: { status: SupplierAssignmentStatus }) {
  if (status === "COMPLETED") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (status === "CANCELLED") {
    return <X className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <Hourglass className="size-3.5 shrink-0 text-amber-600" aria-hidden />;
}
