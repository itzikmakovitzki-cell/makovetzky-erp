"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { ContactFormDialog } from "./contact-form-dialog";

// Block 33 — opens the shared ContactFormDialog in "create" mode. Used
// on both /permits/[id]/contacts (back-office) and /portal/permit/[id]
// (portal). Variant toggles between filled primary CTA (portal, big
// visual weight) and outlined back-office row action.

export function AddContactButton({
  permitId,
  variant = "primary"
}: {
  permitId: string;
  variant?: "primary" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "primary"
      ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
      : "inline-flex items-center gap-1.5 rounded border border-input bg-background px-2.5 py-1 text-[12px] hover:bg-accent";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        <UserPlus className="size-3.5" />
        הוסף איש קשר
      </button>
      {open && (
        <ContactFormDialog
          mode="create"
          permitId={permitId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
