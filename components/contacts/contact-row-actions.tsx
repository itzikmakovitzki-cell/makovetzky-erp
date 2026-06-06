"use client";

import { useState, useTransition } from "react";
import { Loader2, PencilLine, Trash2 } from "lucide-react";
import {
  ContactFormDialog,
  type ContactInitialValues
} from "./contact-form-dialog";
import { deleteProjectContact } from "@/app/actions/project-contacts";

// Block 33 — back-office only row actions (Edit + Delete). The portal
// surface omits this component entirely so clients can't accidentally
// wipe entries the PM is relying on. createdBy still surfaces in the
// audit log if a delete needs to be traced.

export function ContactRowActions({
  permitId,
  contact
}: {
  permitId: string;
  contact: ContactInitialValues & { id: string; name: string };
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function onDelete() {
    if (
      !window.confirm(
        `למחוק את "${contact.name}" מספר הטלפונים של הפרויקט?\n\nפעולה לא הפיכה — אין סל מחזור.`
      )
    ) {
      return;
    }
    startDelete(async () => {
      const res = await deleteProjectContact(contact.id);
      if (!res.ok) window.alert(res.error);
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="ערוך"
        title="ערוך"
      >
        <PencilLine className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50"
        aria-label="מחק"
        title="מחק"
      >
        {isDeleting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Trash2 className="size-3.5" />
        )}
      </button>

      {editOpen && (
        <ContactFormDialog
          mode="edit"
          permitId={permitId}
          initial={contact}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
