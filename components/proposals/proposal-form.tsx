"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { createProposal, updateProposal } from "@/app/actions/proposals";
import type { ProposalMilestoneJson } from "@/app/actions/proposals";
import { formatILS } from "@/lib/utils";
import { DEFAULT_SERVICE_DESCRIPTION } from "@/lib/proposal-template";

type Milestone = { description: string; amount: string; dueDate: string };

function fromJson(arr: ProposalMilestoneJson[]): Milestone[] {
  if (arr.length === 0) {
    return [{ description: "", amount: "", dueDate: "" }];
  }
  return arr.map((m) => ({
    description: m.description,
    amount: String(m.amount),
    dueDate: m.dueDate ? m.dueDate.slice(0, 10) : ""
  }));
}

function toJson(rows: Milestone[]): ProposalMilestoneJson[] {
  return rows
    .map((r) => ({
      description: r.description.trim(),
      amount: Number(r.amount.replace(/,/g, "")),
      dueDate: r.dueDate || undefined
    }))
    .filter((m) => m.description && Number.isFinite(m.amount) && m.amount >= 0);
}

export function ProposalForm({
  mode,
  initial
}: {
  mode: "create" | "update";
  initial?: {
    id: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    projectLocation: string;
    totalAmount: string;
    terms: string;
    quoteTitle: string;
    serviceDescription: string;
    milestones: ProposalMilestoneJson[];
  };
}) {
  const router = useRouter();
  const [createState, createAction, createPending] = useActionState(
    createProposal,
    { ok: false, error: null }
  );
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updatePending, setUpdatePending] = useState(false);

  const [milestones, setMilestones] = useState<Milestone[]>(
    initial ? fromJson(initial.milestones) : fromJson([])
  );
  const [totalAmount, setTotalAmount] = useState(initial?.totalAmount ?? "");

  const milestoneSum = useMemo(
    () =>
      milestones.reduce(
        (s, m) => s + (Number(m.amount.replace(/,/g, "")) || 0),
        0
      ),
    [milestones]
  );
  const totalNum = Number(totalAmount.replace(/,/g, "")) || 0;
  const sumMismatch = Math.abs(milestoneSum - totalNum) > 0.01;

  const updateMilestone = (i: number, patch: Partial<Milestone>) => {
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m))
    );
  };
  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { description: "", amount: "", dueDate: "" }
    ]);
  };
  const removeMilestone = (i: number) => {
    setMilestones((prev) =>
      prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)
    );
  };

  // For mode=create we rely on useActionState's <form action={createAction}>.
  // For mode=update we POST via a custom handler so we can call the
  // single-argument updateProposal(id, formData) signature.
  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUpdateError(null);
    setUpdatePending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("milestones", JSON.stringify(toJson(milestones)));
    const res = await updateProposal(initial!.id, fd);
    setUpdatePending(false);
    if (!res.ok) {
      setUpdateError(res.error ?? "שגיאה לא צפויה");
      return;
    }
    router.push(`/proposals/${initial!.id}`);
    router.refresh();
  };

  // If create succeeded, navigate to the new proposal view page.
  if (createState.ok && createState.id) {
    if (typeof window !== "undefined") {
      router.push(`/proposals/${createState.id}`);
    }
  }

  const isPending = createPending || updatePending;
  const error = createState.error || updateError;

  return (
    <form
      action={mode === "create" ? createAction : undefined}
      onSubmit={mode === "update" ? handleUpdate : undefined}
      className="space-y-4"
    >
      <input
        type="hidden"
        name="milestones"
        value={JSON.stringify(toJson(milestones))}
      />

      <section className="rounded-md border bg-card">
        <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          פרטי ההצעה
        </h2>
        <div className="grid grid-cols-1 gap-3 p-3">
          <Field
            label="כותרת ההצעה"
            name="quoteTitle"
            defaultValue={initial?.quoteTitle}
            placeholder='למשל: "ליווי וניהול לקבלת תעודת גמר (טופס 4)"'
          />
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium">
              מהות השירות (יוצג כבולטים תחת ״השירות כולל״)
            </span>
            <textarea
              name="serviceDescription"
              defaultValue={
                initial?.serviceDescription ?? DEFAULT_SERVICE_DESCRIPTION
              }
              rows={6}
              placeholder="שורה לכל בולט"
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              כל שורה הופכת לבולט נפרד ב-PDF. ערך ברירת המחדל ערוך — שנה לפי הצורך.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          פרטי הלקוח
        </h2>
        <div className="grid grid-cols-2 gap-3 p-3">
          <Field
            label="שם הלקוח"
            name="customerName"
            required
            defaultValue={initial?.customerName}
            placeholder="ישראל ישראלי"
          />
          <Field
            label="טלפון"
            name="customerPhone"
            required
            inputMode="tel"
            defaultValue={initial?.customerPhone}
            placeholder="050-1234567"
          />
          <Field
            label="אימייל"
            name="customerEmail"
            type="email"
            defaultValue={initial?.customerEmail}
            placeholder="customer@example.com"
          />
          <Field
            label="כתובת הפרויקט"
            name="projectLocation"
            defaultValue={initial?.projectLocation}
            placeholder="רחוב הזית 5, רחובות"
          />
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            תנאים מסחריים
          </h2>
          <div className="text-[11px] text-muted-foreground">
            סכום אבני דרך:{" "}
            <span
              className={
                sumMismatch
                  ? "font-semibold text-red-600"
                  : "font-semibold text-emerald-600"
              }
            >
              {formatILS(milestoneSum)}
            </span>
          </div>
        </div>
        <div className="p-3">
          <Field
            label="סכום כולל (₪)"
            name="totalAmount"
            required
            inputMode="decimal"
            value={totalAmount}
            onChange={(v) => setTotalAmount(v)}
            placeholder="50000"
          />
          {sumMismatch && totalNum > 0 && (
            <div className="mt-2 rounded border border-amber-500/40 bg-amber-50/60 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
              שים לב: סכום אבני הדרך ({formatILS(milestoneSum)}) חייב להיות שווה לסכום הכולל ({formatILS(totalNum)}).
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            אבני דרך לתשלום ({milestones.length})
          </h2>
          <button
            type="button"
            onClick={addMilestone}
            className="inline-flex items-center gap-1 rounded border border-foreground bg-foreground px-2 py-0.5 text-[11px] font-medium text-background hover:opacity-90"
          >
            <Plus className="size-3" />
            הוסף אבן דרך
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>תיאור</th>
              <th className="w-32">סכום (₪)</th>
              <th className="w-32">תאריך יעד</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((m, i) => (
              <tr key={i}>
                <td>
                  <input
                    type="text"
                    value={m.description}
                    onChange={(e) =>
                      updateMilestone(i, { description: e.target.value })
                    }
                    placeholder='למשל: "מקדמה בעת חתימת חוזה"'
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={m.amount}
                    onChange={(e) =>
                      updateMilestone(i, { amount: e.target.value })
                    }
                    placeholder="15000"
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={m.dueDate}
                    onChange={(e) =>
                      updateMilestone(i, { dueDate: e.target.value })
                    }
                    className="w-full rounded border border-input bg-background px-2 py-1 text-[12px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    onClick={() => removeMilestone(i)}
                    disabled={milestones.length === 1}
                    title={milestones.length === 1 ? "חובה להשאיר לפחות אבן דרך אחת" : "הסר"}
                    className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border bg-card">
        <h2 className="border-b bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          תנאים והערות (יוצגו ללקוח)
        </h2>
        <div className="p-3">
          <textarea
            name="terms"
            defaultValue={initial?.terms}
            rows={5}
            placeholder="לדוגמה: התשלום מתבצע בהעברה בנקאית. אחריות 12 חודש על העבודה. תקופת השלמה משוערת — 6 חודשים מיום חתימת ההסכם."
            className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </section>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="rounded border border-input bg-background px-3 py-1 text-[12px] hover:bg-accent disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          type="submit"
          disabled={isPending || sumMismatch}
          className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-4 py-1 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          {mode === "create" ? "צור הצעה" : "שמור שינויים"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  type = "text",
  inputMode,
  defaultValue,
  value,
  onChange,
  placeholder
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: "text" | "email";
  inputMode?: "tel" | "decimal";
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}) {
  const controlled = value !== undefined;
  return (
    <label className="block">
      <span className="mb-0.5 block text-[11px] font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        inputMode={inputMode}
        defaultValue={controlled ? undefined : defaultValue}
        value={controlled ? value : undefined}
        onChange={controlled ? (e) => onChange?.(e.target.value) : undefined}
        placeholder={placeholder}
        className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}
