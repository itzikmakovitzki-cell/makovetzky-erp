"use client";

import { useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { approveDocument } from "@/app/actions/documents";
import { cn } from "@/lib/utils";

export function ApproveDocumentButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const confirmed = window.confirm(
          "לאשר את המסמך?\n\n" +
            "הפעולה תסמן את המסמך כגרסה האחרונה המאושרת.\n" +
            "אם קיימת גרסה קודמת מאושרת לאותה משימה — היא תאבד את סימון 'אחרון'.\n" +
            "הפעולה תתועד ב-Audit Log."
        );
        if (!confirmed) return;
        startTransition(() => {
          void approveDocument(documentId);
        });
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
      )}
      title="אשר מסמך וסמן כגרסה האחרונה"
    >
      {pending ? (
        <Loader2 className="size-2.5 animate-spin" />
      ) : (
        <CheckCircle2 className="size-2.5" />
      )}
      אשר
    </button>
  );
}
