"use client";

import Link from "next/link";
import { Building2, Loader2, Pencil, Phone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { ClientRow } from "./clients-page-client";
import type { ClientFormInitial } from "./client-form-dialog";

export function ClientMobileCard({
  row,
  isDeleting,
  onEdit,
  onDelete
}: {
  row: ClientRow;
  isDeleting: boolean;
  onEdit: (id: string, initial: ClientFormInitial) => void;
  onDelete: (row: ClientRow) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${row.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium leading-snug text-foreground underline-offset-2 hover:underline"
          >
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="line-clamp-2">{row.companyName}</span>
          </Link>
          {row.hp && (
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              ח.פ. {row.hp}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="text-[12px] text-foreground">{row.contactName}</div>
        {row.phone && (
          <a
            href={`tel:${row.phone}`}
            className="inline-flex items-center gap-1 text-[12px] tabular-nums text-primary underline-offset-2 hover:underline"
          >
            <Phone className="size-3" />
            {row.phone}
          </a>
        )}
        {row.email && (
          <a
            href={`mailto:${row.email}`}
            className="block truncate text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {row.email}
          </a>
        )}
        <div className="flex items-center gap-3 pt-1 text-[11px] tabular-nums text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{row.activePermitCount}</span>{" "}
            פרויקטים פעילים
            {row.permitCount > row.activePermitCount && (
              <span className="text-muted-foreground/70"> / {row.permitCount}</span>
            )}
          </span>
          <span>·</span>
          <span>
            <span className="font-semibold text-foreground">{row.dealCount}</span> עסקאות
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <button
          type="button"
          onClick={() =>
            onEdit(row.id, {
              companyName: row.companyName,
              hp: row.hp ?? "",
              contactName: row.contactName,
              phone: row.phone,
              email: row.email ?? "",
              address: row.address ?? "",
              notes: row.notes ?? ""
            })
          }
          className="inline-flex items-center gap-1 rounded border border-input px-2 py-1 text-[11px] hover:bg-accent"
        >
          <Pencil className="size-3" /> ערוך
        </button>
        <button
          type="button"
          onClick={() => onDelete(row)}
          disabled={isDeleting}
          className={cn(
            "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
            isDeleting && "cursor-not-allowed opacity-50"
          )}
        >
          {isDeleting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Trash2 className="size-3" />
          )}
          מחק
        </button>
      </CardFooter>
    </Card>
  );
}
