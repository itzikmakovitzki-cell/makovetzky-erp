"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteClient } from "@/app/actions/clients";
import { ClientFormDialog, type ClientFormInitial } from "./client-form-dialog";
import Link from "next/link";

export function ClientProfileActions({
  client,
  dealCount
}: {
  client: { id: string } & ClientFormInitial;
  dealCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const canDelete = dealCount === 0;

  const handleDelete = () => {
    if (
      !window.confirm(
        `למחוק את "${client.companyName}"?\nהפעולה לא ניתנת לביטול.`
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteClient(client.id);
        router.push("/clients");
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/permits/new"
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
      >
        <Plus className="size-3" />
        פרויקט ללקוח
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
      >
        <Pencil className="size-3" />
        ערוך
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={!canDelete || pending}
        title={canDelete ? "מחק לקוח" : `לא ניתן למחוק — ${dealCount} עסקאות שייכות ללקוח`}
        className={cn(
          "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
          (!canDelete || pending) && "cursor-not-allowed opacity-50"
        )}
      >
        {pending ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
        מחק
      </button>

      {editing && (
        <ClientFormDialog
          mode={{
            kind: "update",
            id: client.id,
            initial: {
              companyName: client.companyName,
              hp: client.hp,
              contactName: client.contactName,
              phone: client.phone,
              email: client.email,
              address: client.address,
              notes: client.notes
            }
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
