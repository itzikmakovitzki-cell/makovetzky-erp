"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Loader2, FolderPlus, UserPlus, Wallet, FileCheck2, AlertTriangle, Info } from "lucide-react";
import { createProject } from "@/app/actions/projects";
import { cn } from "@/lib/utils";

export function NewProjectForm({
  clients,
  authorities,
  buildingTypes,
  templateCountByCombo
}: {
  clients: { id: string; name: string; companyName: string | null }[];
  authorities: { id: string; name: string }[];
  buildingTypes: { id: string; name: string }[];
  templateCountByCombo: Record<string, number>;
}) {
  const [state, formAction, isPending] = useActionState(createProject, {
    error: null
  });

  const [clientMode, setClientMode] = useState<"existing" | "new">(
    clients.length > 0 ? "existing" : "new"
  );
  const [authorityId, setAuthorityId] = useState("");
  const [buildingTypeId, setBuildingTypeId] = useState("");

  const templateCount = useMemo(() => {
    if (!authorityId || !buildingTypeId) return null;
    return templateCountByCombo[`${authorityId}:${buildingTypeId}`] ?? 0;
  }, [authorityId, buildingTypeId, templateCountByCombo]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="clientMode" value={clientMode} />

      {/* ============ 1. CLIENT ============ */}
      <Section
        index="1"
        icon={<UserPlus className="size-4" />}
        title="לקוח"
      >
        <div className="mb-3 inline-flex rounded border border-input p-0.5 text-[11px]">
          <ToggleButton
            active={clientMode === "existing"}
            disabled={clients.length === 0}
            onClick={() => setClientMode("existing")}
          >
            לקוח קיים
          </ToggleButton>
          <ToggleButton
            active={clientMode === "new"}
            onClick={() => setClientMode("new")}
          >
            לקוח חדש
          </ToggleButton>
        </div>

        {clientMode === "existing" ? (
          <Field label="בחר לקוח" required>
            <select
              name="existingClientId"
              required
              defaultValue=""
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— בחר לקוח —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.companyName ? ` · ${c.companyName}` : ""}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="שם הלקוח" required>
              <input
                type="text"
                name="clientName"
                required
                maxLength={120}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="שם חברה">
              <input
                type="text"
                name="clientCompany"
                maxLength={120}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="איש קשר ראשי">
              <input
                type="text"
                name="clientContact"
                maxLength={120}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="טלפון">
              <input
                type="tel"
                name="clientPhone"
                maxLength={32}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="אימייל">
              <input
                type="email"
                name="clientEmail"
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="כתובת">
              <input
                type="text"
                name="clientAddress"
                maxLength={200}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ============ 2. DEAL ============ */}
      <Section
        index="2"
        icon={<Wallet className="size-4" />}
        title="עסקה (Master Deal)"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם העסקה" required>
            <input
              type="text"
              name="dealName"
              required
              maxLength={200}
              placeholder='למשל: פרויקט 7 וילות — רחובות'
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="ערך עסקה (₪)">
            <input
              type="number"
              name="totalValue"
              min={0}
              step={0.01}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="תאריך חוזה">
            <input
              type="date"
              name="contractDate"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="הערות לעסקה">
            <textarea
              name="dealNotes"
              rows={2}
              className="w-full resize-y rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>
      </Section>

      {/* ============ 3. PERMIT ============ */}
      <Section
        index="3"
        icon={<FileCheck2 className="size-4" />}
        title="היתר (Permit) + יצירה אוטומטית של משימות"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="שם ההיתר" required>
            <input
              type="text"
              name="permitName"
              required
              maxLength={200}
              placeholder='למשל: טופס 4 — 7 וילות רחובות'
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="מספר היתר">
            <input
              type="text"
              name="permitNumber"
              maxLength={80}
              placeholder="REH-2026-XXXX"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="סוג היתר">
            <input
              type="text"
              name="permitType"
              maxLength={80}
              placeholder="טופס 4"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="רשות" required>
            <select
              name="authorityId"
              required
              value={authorityId}
              onChange={(e) => setAuthorityId(e.target.value)}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— בחר רשות —</option>
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
              value={buildingTypeId}
              onChange={(e) => setBuildingTypeId(e.target.value)}
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— בחר סוג —</option>
              {buildingTypes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="תאריך התחלה">
            <input
              type="date"
              name="startDate"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
          <Field label="תאריך סיום צפוי">
            <input
              type="date"
              name="expectedCloseDate"
              className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        {/* Template generation hint */}
        {templateCount !== null && (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded border px-2.5 py-2 text-[11px]",
              templateCount === 0
                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            )}
          >
            {templateCount === 0 ? (
              <>
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  אין תבניות משימות לצירוף הזה. ההיתר ייווצר ללא משימות. תוכל
                  להוסיף תבניות ב-<Link href="/settings/templates" className="underline">הגדרות &raquo; תבניות משימות</Link>.
                </span>
              </>
            ) : (
              <>
                <Info className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong>{templateCount}</strong> משימות יווצרו אוטומטית מהתבניות
                  של הצירוף הזה — כולל הקשרים (תלויות) ביניהן.
                </span>
              </>
            )}
          </div>
        )}

        {/* Buildings (optional) */}
        <div className="mt-3 rounded border border-dashed border-input bg-muted/30 p-2.5">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            יחידות / בניינים (אופציונלי)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="כמות יחידות ליצירה">
              <input
                type="number"
                name="buildingCount"
                defaultValue={0}
                min={0}
                max={200}
                step={1}
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="prefix לשמות">
              <input
                type="text"
                name="buildingPrefix"
                maxLength={40}
                placeholder='למשל: וילה — ייוצרו "וילה 1", "וילה 2"...'
                className="w-full rounded border border-input bg-background px-2 py-1 text-[13px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>
        </div>

        {/* Generate tasks toggle */}
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          <label className="inline-flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              name="generateTasks"
              value="true"
              defaultChecked
              className="size-3.5"
            />
            צור משימות אוטומטית מתבניות (מומלץ)
          </label>
        </div>
      </Section>

      {state.error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Link
          href="/permits"
          className="rounded border border-input bg-background px-3 py-1.5 text-[12px] hover:bg-accent"
        >
          ביטול
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded border border-foreground bg-foreground px-4 py-1.5 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <FolderPlus className="size-3.5" />
          )}
          צור פרויקט
        </button>
      </div>
    </form>
  );
}

function Section({
  index,
  icon,
  title,
  children
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
          {index}
        </span>
        {icon}
        <h2 className="text-xs font-semibold uppercase tracking-wide">{title}</h2>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function ToggleButton({
  active,
  disabled,
  onClick,
  children
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded px-2.5 py-0.5 transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {children}
    </button>
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
