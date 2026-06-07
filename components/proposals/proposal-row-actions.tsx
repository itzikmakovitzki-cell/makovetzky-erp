"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  ArrowRightCircle,
  Eye,
  MoreHorizontal,
  Pencil,
  Send,
  ShieldX,
  Trash2
} from "lucide-react";
import type { ProposalStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { deleteProposal, markProposalSent } from "@/app/actions/proposals";
import { rejectProposal } from "@/app/actions/proposals-public";
import { convertProposalToProject } from "@/app/actions/proposals-convert";

export function ProposalRowActions({
  proposalId,
  customerName,
  status,
  isConverted
}: {
  proposalId: string;
  customerName: string;
  status: ProposalStatus;
  isConverted: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const canEdit = status === "DRAFT";
  const canSend = status === "DRAFT";
  const canReject = status === "DRAFT" || status === "SENT";
  const canConvert = status === "SIGNED" && !isConverted;

  const handleAction = (
    op: () => Promise<{ ok: boolean; error: string | null } | unknown>,
    onSuccess?: () => void
  ) => {
    startTransition(async () => {
      try {
        const result = (await op()) as { ok?: boolean; error?: string | null };
        if (result && result.ok === false) {
          window.alert(result.error ?? "פעולה נכשלה");
          return;
        }
        onSuccess?.();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "פעולה נכשלה");
      }
    });
  };

  return (
    <DropdownMenu align="end">
      <DropdownMenuTrigger
        className="size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`פעולות עבור ${customerName}`}
        disabled={pending}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[14rem]">
        <DropdownMenuItem
          icon={<Eye className="size-3.5" />}
          onSelect={() => router.push(`/proposals/${proposalId}`)}
        >
          צפה בהצעה
        </DropdownMenuItem>
        {canEdit && (
          <DropdownMenuItem
            icon={<Pencil className="size-3.5" />}
            onSelect={() => router.push(`/proposals/${proposalId}/edit`)}
          >
            ערוך טיוטה
          </DropdownMenuItem>
        )}

        {(canSend || canReject || canConvert) && <DropdownMenuSeparator />}
        {canSend && (
          <DropdownMenuItem
            icon={<Send className="size-3.5" />}
            onSelect={() =>
              handleAction(() => markProposalSent(proposalId))
            }
          >
            סמן כנשלחה
          </DropdownMenuItem>
        )}
        {canConvert && (
          <DropdownMenuItem
            icon={<ArrowRightCircle className="size-3.5" />}
            onSelect={() => {
              if (
                !window.confirm(
                  `להמיר את ההצעה "${customerName}" לפרויקט? פעולה זו תיצור לקוח + MasterDeal + אבני דרך.`
                )
              ) {
                return;
              }
              handleAction(() => convertProposalToProject(proposalId));
            }}
          >
            המר לפרויקט
          </DropdownMenuItem>
        )}
        {canReject && (
          <DropdownMenuItem
            icon={<ShieldX className="size-3.5" />}
            onSelect={() => {
              const reason = window.prompt(
                `סיבת דחייה עבור "${customerName}" (אופציונלי):`,
                ""
              );
              // window.prompt returns null on Cancel — only proceed when the user
              // explicitly confirmed (clicked OK, even with an empty reason).
              if (reason === null) return;
              handleAction(() => rejectProposal(proposalId, reason));
            }}
          >
            דחה הצעה
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          icon={<Trash2 className="size-3.5" />}
          onSelect={() => {
            if (!window.confirm(`למחוק את ההצעה של "${customerName}"?`)) return;
            handleAction(() => deleteProposal(proposalId));
          }}
        >
          מחק
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
