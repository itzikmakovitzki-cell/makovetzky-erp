"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  CheckCircle2,
  ExternalLink,
  ListChecks,
  MoreHorizontal,
  RotateCcw,
  Trash2
} from "lucide-react";
import type { PermitStatus } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  deletePermit,
  markPermitCompleted,
  reopenPermit
} from "@/app/actions/permits";

export function PermitRowActions({
  permitId,
  permitName,
  status,
  isAdmin
}: {
  permitId: string;
  permitName: string;
  status: PermitStatus;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isCompleted = status === "COMPLETED";

  return (
    <DropdownMenu align="end">
      <DropdownMenuTrigger
        className="size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`פעולות עבור ${permitName}`}
        disabled={pending}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[13rem]">
        <DropdownMenuItem
          icon={<ListChecks className="size-3.5" />}
          onSelect={() => router.push(`/permits/${permitId}/tasks`)}
        >
          פתח משימות
        </DropdownMenuItem>
        <DropdownMenuItem
          icon={<ExternalLink className="size-3.5" />}
          onSelect={() => router.push(`/permits/${permitId}/documents`)}
        >
          פתח מסמכים
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            {isCompleted ? (
              <DropdownMenuItem
                icon={<RotateCcw className="size-3.5" />}
                onSelect={() => {
                  startTransition(async () => {
                    try {
                      await reopenPermit(permitId);
                      router.refresh();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : "פעולה נכשלה");
                    }
                  });
                }}
              >
                פתח מחדש
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                icon={<CheckCircle2 className="size-3.5" />}
                onSelect={() => {
                  if (!window.confirm(`לסמן את ההיתר "${permitName}" כהושלם?`)) return;
                  startTransition(async () => {
                    try {
                      await markPermitCompleted(permitId);
                      router.refresh();
                    } catch (err) {
                      window.alert(err instanceof Error ? err.message : "פעולה נכשלה");
                    }
                  });
                }}
              >
                סמן כהושלם
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              icon={<Trash2 className="size-3.5" />}
              onSelect={() => {
                if (!window.confirm(`למחוק את ההיתר "${permitName}"?`)) return;
                startTransition(async () => {
                  try {
                    await deletePermit(permitId);
                    router.refresh();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "מחיקה נכשלה");
                  }
                });
              }}
            >
              מחק היתר
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
