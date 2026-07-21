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
    <Card className="group h-full overflow-hidden rounded-2xl border-white/80 bg-white/95 shadow-[0_8px_28px_rgba(31,41,55,0.07)] transition-all duration-200 md:hover:-translate-y-0.5 md:hover:shadow-[0_14px_36px_rgba(31,41,55,0.12)]">
      <div aria-hidden className="h-1 bg-gradient-to-l from-primary via-brand-orange-light to-brand-cream" />
      <CardHeader className="p-4 pb-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${row.id}`}
            className="inline-flex cursor-pointer items-center gap-2 text-base font-extrabold leading-snug text-brand-navy underline-offset-2 hover:underline"
          >
            <Building2 className="size-4 shrink-0 text-primary" />
            <span className="line-clamp-2">{row.companyName}</span>
          </Link>
          {row.hp && (
            <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
              ח.פ. {row.hp}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-4 pb-4">
        <div className="text-sm font-semibold text-foreground">{row.contactName}</div>
        {row.phone && (
          <a
            href={`tel:${row.phone}`}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 text-sm font-semibold tabular-nums text-primary transition-colors hover:bg-primary/15"
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

      <CardFooter className="min-h-12 bg-[#fbfaf7] px-4 py-3">
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
              notes: row.notes ?? "",
              clientType: row.clientType
            })
          }
          className="inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-xl border border-input px-3 py-2 text-xs font-semibold transition-colors hover:bg-accent"
        >
          <Pencil className="size-3" /> ערוך
        </button>
        <button
          type="button"
          onClick={() => onDelete(row)}
          disabled={isDeleting}
          className={cn(
            "inline-flex min-h-10 cursor-pointer items-center gap-1 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-800 transition-colors hover:bg-red-500/20 dark:text-red-300",
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
