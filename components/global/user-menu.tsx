import { LogOut } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { signOutAction } from "@/app/actions/auth";

const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "מנהל",
  EMPLOYEE: "עובד",
  CONTRACTOR: "קבלן"
};

const ROLE_DOT: Record<UserRole, string> = {
  ADMIN: "bg-amber-500",
  EMPLOYEE: "bg-sky-500",
  CONTRACTOR: "bg-zinc-400"
};

export function UserMenu({
  name,
  email,
  role
}: {
  name: string;
  email: string;
  role: UserRole;
}) {
  return (
    <div className="mt-auto border-t pt-3">
      <div className="mb-1 px-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-1.5 rounded-full ${ROLE_DOT[role]}`} />
          <span className="text-xs font-medium">{name}</span>
        </div>
        <div className="text-[10px] text-muted-foreground" title={email}>
          {ROLE_LABEL[role]} · <span className="truncate">{email}</span>
        </div>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground/80 hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="size-3.5" />
          התנתק
        </button>
      </form>
    </div>
  );
}
