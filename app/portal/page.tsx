import { Construction, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function ContractorPortalPage() {
  const session = await auth();
  const name = session?.user?.name ?? "אורח";
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-md border bg-card p-6 text-center shadow-sm">
        <Construction className="mx-auto size-8 text-amber-600" />
        <h1 className="mt-3 text-base font-semibold">שלום, {name}</h1>
        <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
          פורטל הקבלן בבנייה. בקרוב תוכל לצפות בארכיון מסמכים, התקדמות וקבצי טופס 4
          של הפרויקטים שלך.
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          בינתיים, צוות מקובצקי יעדכן אותך באופן יזום.
        </p>

        {isAdmin && (
          <div className="mt-3 rounded border border-dashed border-input bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
            צפייה כאדמין — כך הקבלן יראה את הפורטל
          </div>
        )}

        <form action={signOutAction} className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded border border-input bg-background px-3 py-1.5 text-[12px] hover:bg-accent"
          >
            <LogOut className="size-3" /> התנתק
          </button>
        </form>
      </div>
    </main>
  );
}
