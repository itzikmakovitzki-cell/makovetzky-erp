"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { grantPortalAccess } from "@/app/actions/portal-access";

type ContractorUser = { id: string; name: string; email: string };

export function GrantPortalAccessDialog({
  clientId,
  candidates,
  onClose
}: {
  clientId: string;
  candidates: ContractorUser[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string>(candidates[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const handler = () => onClose();
    d.addEventListener("close", handler);
    return () => d.removeEventListener("close", handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("יש לבחור משתמש");
      return;
    }
    startTransition(async () => {
      const res = await grantPortalAccess(clientId, selected);
      if (!res.ok) {
        setError(res.error || "שגיאה לא צפויה");
        return;
      }
      dialogRef.current?.close();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className="mk-dialog w-[440px] max-w-[calc(100vw-2rem)]"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">הוסף גישת קבלן</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="סגור"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-3 py-3">
          {candidates.length === 0 ? (
            <div className="rounded border border-amber-500/40 bg-amber-50/60 px-2 py-2 text-[12px] text-amber-900 dark:bg-amber-500/5 dark:text-amber-200">
              אין משתמשי קבלן פנויים. הוסף תחילה משתמש חדש ב-<code>/settings/users</code> עם תפקיד "קבלן".
            </div>
          ) : (
            <>
              <label className="block">
                <span className="mb-0.5 block text-[11px] font-medium">משתמש קבלן</span>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {candidates.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded border border-input bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                לאחר הקישור הקבלן יראה בפורטל את ההיתרים של הלקוח, אך רק את המשימות ששויכו אליו אישית. נתונים פיננסיים לא ייחשפו.
              </div>
            </>
          )}

          {error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-3 py-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            disabled={isPending}
            className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="submit"
            disabled={isPending || candidates.length === 0}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            הענק גישה
          </button>
        </div>
      </form>
    </dialog>
  );
}
