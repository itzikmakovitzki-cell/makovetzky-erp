"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  Briefcase,
  FileCheck2,
  FileText,
  ListChecks,
  Loader2,
  RotateCcw,
  Trash2
} from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";
import { purgeTrashed, restoreTrashed } from "@/app/actions/recycle-bin";
import type { TrashableKind } from "@/lib/soft-delete";

export type TrashedRow = {
  id: string;
  label: string;
  secondary: string | null;
  deletedAt: string; // ISO
};

export type RecycleBinData = {
  client: TrashedRow[];
  masterDeal: TrashedRow[];
  permit: TrashedRow[];
  task: TrashedRow[];
  document: TrashedRow[];
};

type Section = {
  kind: TrashableKind;
  title: string;
  icon: typeof FileCheck2;
  secondaryLabel: string;
};

const SECTIONS: Section[] = [
  { kind: "client", title: "לקוחות", icon: Building2, secondaryLabel: "איש קשר" },
  { kind: "masterDeal", title: "עסקאות", icon: Briefcase, secondaryLabel: "לקוח" },
  { kind: "permit", title: "היתרים", icon: FileCheck2, secondaryLabel: "מספר היתר" },
  { kind: "task", title: "משימות", icon: ListChecks, secondaryLabel: "היתר" },
  { kind: "document", title: "מסמכים", icon: FileText, secondaryLabel: "היתר" }
];

export function RecycleBinClient({ data }: { data: RecycleBinData }) {
  const total =
    data.client.length +
    data.masterDeal.length +
    data.permit.length +
    data.task.length +
    data.document.length;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h1 className="text-base font-semibold">סל המחזור ({total})</h1>
        <p className="text-[11px] text-muted-foreground">
          פריטים שנמחקו ניתנים לשחזור. "מחק לצמיתות" מוחק לחלוטין מבסיס הנתונים, ועבור
          מסמכים גם מוחק את הקובץ מאחסון Supabase — פעולה בלתי הפיכה.
        </p>
      </header>

      {total === 0 && (
        <div className="rounded-md border bg-card px-3 py-8 text-center text-xs text-muted-foreground">
          סל המחזור ריק. כל הפריטים פעילים.
        </div>
      )}

      {SECTIONS.map((section) => {
        const rows = data[section.kind];
        if (rows.length === 0) return null;
        return (
          <SectionTable
            key={section.kind}
            section={section}
            rows={rows}
          />
        );
      })}
    </section>
  );
}

function SectionTable({
  section,
  rows
}: {
  section: Section;
  rows: TrashedRow[];
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-1.5">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <section.icon className="size-3.5" />
          {section.title} ({rows.length})
        </h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>שם</th>
            <th className="w-48">{section.secondaryLabel}</th>
            <th className="w-36">תאריך מחיקה</th>
            <th className="w-44">פעולות</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TrashedRowItem
              key={`${section.kind}:${row.id}`}
              kind={section.kind}
              kindLabel={section.title.slice(0, -2) || section.title}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrashedRowItem({
  kind,
  kindLabel,
  row
}: {
  kind: TrashableKind;
  kindLabel: string;
  row: TrashedRow;
}) {
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<"restore" | "purge" | null>(null);

  const handleRestore = () => {
    if (!window.confirm(`לשחזר את "${row.label}"?`)) return;
    setAction("restore");
    startTransition(async () => {
      try {
        await restoreTrashed(kind, row.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setAction(null);
      }
    });
  };

  const handlePurge = () => {
    const confirmed = window.confirm(
      `למחוק לצמיתות את "${row.label}"?\n\n` +
        "הפעולה אינה הפיכה. הרשומה תוסר מבסיס הנתונים. " +
        "אם זה מסמך, הקובץ יימחק גם מהאחסון."
    );
    if (!confirmed) return;
    setAction("purge");
    startTransition(async () => {
      try {
        await purgeTrashed(kind, row.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "שגיאה");
      } finally {
        setAction(null);
      }
    });
  };

  return (
    <tr className="hover:bg-muted/30">
      <td className="font-medium">{row.label}</td>
      <td className="text-[11px] text-muted-foreground">
        {row.secondary ?? "—"}
      </td>
      <td className="text-[11px] tabular-nums text-muted-foreground">
        {formatDateTime(row.deletedAt)}
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRestore}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-300",
              pending && "cursor-not-allowed opacity-50"
            )}
            title={`שחזר ${kindLabel}`}
          >
            {pending && action === "restore" ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              <RotateCcw className="size-2.5" />
            )}
            שחזר
          </button>
          <button
            type="button"
            onClick={handlePurge}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1 rounded border border-red-500/50 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-800 hover:bg-red-500/20 dark:text-red-300",
              pending && "cursor-not-allowed opacity-50"
            )}
            title="מחק לצמיתות"
          >
            {pending && action === "purge" ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              <Trash2 className="size-2.5" />
            )}
            מחק לצמיתות
          </button>
        </div>
      </td>
    </tr>
  );
}
