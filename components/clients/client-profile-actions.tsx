"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { deleteClient } from "@/app/actions/clients";
import { SoftDeleteButton } from "@/components/global/soft-delete-button";
import { ClientFormDialog, type ClientFormInitial } from "./client-form-dialog";
import Link from "next/link";

export function ClientProfileActions({
  client,
  dealCount
}: {
  client: { id: string } & ClientFormInitial;
  // Active master-deals belonging to this client. Drives the cascade warning
  // copy on the delete button — the action itself cascades into deals →
  // permits → tasks/docs in a single transaction.
  dealCount: number;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/permits/new"
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
      >
        <Plus className="size-3" />
        פרויקט ללקוח
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-background px-4 py-2 text-xs font-semibold transition-colors hover:bg-accent"
      >
        <Pencil className="size-3" />
        ערוך
      </button>
      <SoftDeleteButton
        action={deleteClient}
        id={client.id}
        label={client.companyName}
        buttonLabel="מחק לקוח"
        redirectTo="/clients"
        confirmMessage={
          dealCount === 0
            ? `למחוק את "${client.companyName}"?\n\nהלקוח יעבור לסל המחזור.`
            : `למחוק את "${client.companyName}"?\n\nזה ימחק גם את ${dealCount} העסקאות שלו (וכל ההיתרים והמשימות תחתיהן).\nהכל יעבור לסל המחזור — ניתן לשחזר מ-הגדרות → סל המחזור.`
        }
      />

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
              notes: client.notes,
              clientType: client.clientType
            }
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
