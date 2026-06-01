"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { SupplierFormDialog } from "./supplier-form-dialog";

// ADMIN-only "ספק חדש" trigger. The form body lives in the shared
// SupplierFormDialog so create and edit stay in lockstep field-wise.
export function AddSupplierButton({
  typeSuggestions
}: {
  // Distinct supplier types already in the DB — feeds a datalist autocomplete
  // on the "type" input so admins reuse existing tags ("מודד", "חשמלאי", …)
  // rather than typing slight variants.
  typeSuggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:brightness-110"
      >
        <Plus className="size-4" />
        ספק חדש
      </button>
      {open && (
        <SupplierFormDialog
          mode="create"
          typeSuggestions={typeSuggestions}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
