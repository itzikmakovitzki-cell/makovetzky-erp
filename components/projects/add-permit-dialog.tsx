"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, X, Plus } from "lucide-react";
import { addPermitToDeal } from "@/app/actions/projects";

type Authority = { id: string; name: string };
type BuildingType = { id: string; name: string };

export function AddPermitDialog({
  masterDealId,
  dealName,
  authorities,
  buildingTypes,
  onClose
}: {
  masterDealId: string;
  dealName: string;
  authorities: Authority[];
  buildingTypes: BuildingType[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(addPermitToDeal, {
    error: null,
    ok: false
  });
  const [buildingCount, setBuildingCount] = useState(0);
  const [generateTasks, setGenerateTasks] = useState(true);

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
  useEffect(() => {
    if (state.ok) dialogRef.current?.close();
  }, [state.ok]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="rounded-md border bg-card p-0 text-foreground shadow-lg backdrop:bg-black/40 w-[560px] max-w-[calc(100vw-1.5rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="masterDealId" value={masterDealId} />

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="size-3.5" />
            הוסף היתר לפרויקט
          </h2>
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
          <div className="rounded border bg-muted/30 px-2 py-1 text-[11px]">
            <span className="text-muted-foreground">פרויקט: </span>
            <span className="font-medium">{dealName}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="שם ההיתר" required>
              <input
                type="text"
                name="permitName"
                required
                placeholder="לדוגמה: טופס 4 — בניין מערב"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="מספר היתר">
              <input
                type="text"
                name="permitNumber"
                placeholder="כפי שהוקצה ע&quot;י הרשות"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="סוג היתר">
              <input
                type="text"
                name="permitType"
                placeholder="טופס 4 / טופס 5 / תיקון בקשה…"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="רשות" required>
              <select
                name="authorityId"
                required
                defaultValue=""
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>
                  בחר רשות…
                </option>
                {authorities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="סוג בניין" required>
              <select
                name="buildingTypeId"
                required
                defaultValue=""
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="" disabled>
                  בחר סוג בניין…
                </option>
                {buildingTypes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                קובע אילו תבניות משימה ייווצרו אוטומטית
              </span>
            </Field>
            <Field label="תאריך התחלה">
              <input
                type="date"
                name="startDate"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="צפי סיום">
              <input
                type="date"
                name="expectedCloseDate"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="מספר בניינים">
              <input
                type="number"
                name="buildingCount"
                min={0}
                value={buildingCount}
                onChange={(e) => setBuildingCount(Math.max(0, parseInt(e.target.value || "0", 10)))}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                0 = ללא בניינים. ערך &gt; 0 יוצר רשומות &quot;תווית 1, תווית 2…&quot;.
              </span>
            </Field>
            {buildingCount > 0 && (
              <Field label="קידומת תוויות בניין">
                <input
                  type="text"
                  name="buildingPrefix"
                  placeholder="לדוגמה: בניין / וילה / ספיר"
                  className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="mt-0.5 block text-[10px] text-muted-foreground">
                  אם ריק — ייעשה שימוש בשם סוג הבניין.
                </span>
              </Field>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded border bg-muted/30 px-2.5 py-2">
            <input
              type="checkbox"
              name="generateTasks"
              value="true"
              checked={generateTasks}
              onChange={(e) => setGenerateTasks(e.target.checked)}
              className="mt-0.5 size-3.5"
            />
            <span className="text-[12px]">
              <span className="font-medium">ייצר משימות אוטומטית מתבניות</span>
              <span className="block text-[10px] text-muted-foreground">
                לפי השילוב של הרשות + סוג הבניין שנבחרו. בטל אם תרצה ליצור משימות ידנית בלבד.
              </span>
            </span>
          </label>
          {!generateTasks && (
            <input type="hidden" name="generateTasks" value="false" />
          )}

          {state.error && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
              {state.error}
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
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            צור היתר
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Field({
  label,
  required,
  children
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium text-foreground">
        {label}
        {required && <span className="ms-0.5 text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

// Small wrapper trigger so the dialog can live inside a server component page.
export function AddPermitDialogTrigger({
  masterDealId,
  dealName,
  dealLocked,
  authorities,
  buildingTypes
}: {
  masterDealId: string;
  dealName: string;
  dealLocked: boolean;
  authorities: Authority[];
  buildingTypes: BuildingType[];
}) {
  const [open, setOpen] = useState(false);
  if (dealLocked) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-input bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground"
        title="פרויקט שהושלם או בוטל — לא ניתן להוסיף היתר"
      >
        <Plus className="size-3" />
        הוסף היתר
      </span>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-2.5 py-1 text-[12px] font-medium text-background hover:opacity-90"
      >
        <Plus className="size-3" />
        הוסף היתר
      </button>
      {open && (
        <AddPermitDialog
          masterDealId={masterDealId}
          dealName={dealName}
          authorities={authorities}
          buildingTypes={buildingTypes}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
