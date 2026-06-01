"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  SupplierFormDialog,
  type SupplierInitialValues
} from "./supplier-form-dialog";

// ADMIN-only "ערוך" trigger on the supplier detail card. Opens the shared
// dialog pre-filled with the supplier's current values.
export function EditSupplierButton({
  supplier,
  typeSuggestions
}: {
  supplier: SupplierInitialValues & { id: string; name: string };
  typeSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-input bg-background px-2 py-0.5 text-[11px] hover:bg-accent"
      >
        <Pencil className="size-3" />
        ערוך
      </button>
      {open && (
        <SupplierFormDialog
          mode="edit"
          initial={supplier}
          typeSuggestions={typeSuggestions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
