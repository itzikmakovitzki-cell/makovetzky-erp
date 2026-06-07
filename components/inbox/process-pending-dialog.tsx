"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, X, FileText, ExternalLink } from "lucide-react";
import { assignPendingDocument } from "@/app/actions/inbox";
import { cn, formatDateTime } from "@/lib/utils";

export type PendingDocForDialog = {
  id: string;
  fileName: string | null;
  sourceChannel: string;
  senderInfo: string | null;
  rawMessage: string | null;
  createdAt: string;
  previewUrl: string | null;
};

type Deal = { id: string; name: string };
type Permit = {
  id: string;
  masterDealId: string;
  name: string;
  permitNumber: string | null;
};
type Task = { id: string; permitId: string; name: string };
type Building = { id: string; permitId: string; label: string };

export function ProcessPendingDialog({
  pendingDoc,
  deals,
  permits,
  tasks,
  buildings,
  onClose
}: {
  pendingDoc: PendingDocForDialog;
  deals: Deal[];
  permits: Permit[];
  tasks: Task[];
  buildings: Building[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, isPending] = useActionState(assignPendingDocument, {
    error: null,
    ok: false
  });

  const [selectedDeal, setSelectedDeal] = useState("");
  const [selectedPermit, setSelectedPermit] = useState("");
  const [selectedTask, setSelectedTask] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState("");

  const filteredPermits = useMemo(
    () =>
      selectedDeal ? permits.filter((p) => p.masterDealId === selectedDeal) : [],
    [selectedDeal, permits]
  );
  const filteredTasks = useMemo(
    () => (selectedPermit ? tasks.filter((t) => t.permitId === selectedPermit) : []),
    [selectedPermit, tasks]
  );
  const filteredBuildings = useMemo(
    () =>
      selectedPermit ? buildings.filter((b) => b.permitId === selectedPermit) : [],
    [selectedPermit, buildings]
  );

  // Cascading reset
  useEffect(() => {
    setSelectedPermit("");
    setSelectedTask("");
    setSelectedBuilding("");
  }, [selectedDeal]);
  useEffect(() => {
    setSelectedTask("");
    setSelectedBuilding("");
  }, [selectedPermit]);

  // Dialog lifecycle
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

  const canSubmit = !!selectedPermit && !isPending;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="mk-dialog w-[540px] max-w-[calc(100vw-2rem)]"
    >
      <form action={formAction}>
        <input type="hidden" name="pendingDocId" value={pendingDoc.id} />
        <input type="hidden" name="permitId" value={selectedPermit} />
        <input type="hidden" name="taskId" value={selectedTask} />
        <input type="hidden" name="buildingId" value={selectedBuilding} />

        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-sm font-semibold">שיוך מסמך נכנס</h2>
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
          <div className="rounded border bg-muted/30 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[12px]">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="font-medium">
                {pendingDoc.fileName ?? "מסמך ללא שם"}
              </span>
              {pendingDoc.previewUrl && (
                <a
                  href={pendingDoc.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-auto inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  title="פתח את הקובץ"
                >
                  <ExternalLink className="size-2.5" /> פתח
                </a>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0 text-[10px] text-muted-foreground">
              <span>מקור: {pendingDoc.sourceChannel}</span>
              {pendingDoc.senderInfo && <span>· {pendingDoc.senderInfo}</span>}
              <span>· {formatDateTime(pendingDoc.createdAt)}</span>
            </div>
            {pendingDoc.rawMessage && (
              <div className="mt-1 text-[10px] italic text-muted-foreground line-clamp-2">
                &ldquo;{pendingDoc.rawMessage}&rdquo;
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="עסקה (Master Deal)" required>
              <select
                value={selectedDeal}
                onChange={(e) => setSelectedDeal(e.target.value)}
                required
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">בחר עסקה…</option>
                {deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="היתר (Permit)" required>
              <select
                value={selectedPermit}
                onChange={(e) => setSelectedPermit(e.target.value)}
                disabled={!selectedDeal}
                required
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">
                  {selectedDeal ? "בחר היתר…" : "בחר עסקה קודם"}
                </option>
                {filteredPermits.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.permitNumber ? ` · ${p.permitNumber}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="משימה (אופציונלי)">
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                disabled={!selectedPermit}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— ללא משימה (קובץ ברמת היתר) —</option>
                {filteredTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="יחידה (אופציונלי)">
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                disabled={!selectedPermit}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                <option value="">— ללא יחידה —</option>
                {filteredBuildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="הערת מנהל (אופציונלי)">
            <textarea
              name="notes"
              rows={2}
              placeholder="למשל: תוצאות מעבדה ויצמן עברו ב-100%"
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

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
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-3 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-40"
          >
            {isPending && <Loader2 className="size-3 animate-spin" />}
            שייך
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
