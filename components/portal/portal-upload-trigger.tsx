"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { PortalUploadDialog } from "./portal-upload-dialog";

// Permit-level upload button. Used in the header of the permit detail page
// when the contractor has a document that isn't tied to a specific task yet
// (e.g. "general correspondence with the authority"). Task-scoped uploads
// have their own button on each task row.
export function PortalUploadDialogTrigger({ permitId }: { permitId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90"
      >
        <Upload className="size-3" />
        העלאת מסמך כללי
      </button>
      {open && (
        <PortalUploadDialog
          permitId={permitId}
          taskId={null}
          taskName={null}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
