"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Link2, Loader2 } from "lucide-react";
import { connectGroupToProject } from "@/app/actions/whatsapp-groups";
import { cn, formatDate } from "@/lib/utils";

// Spec: docs/spec-whatsapp-groups.md §4.4 (PR-3).
// /inbox section that shows ProjectWhatsAppGroup rows with masterDealId=null
// — groups that messaged the system before an admin tied them to a project.
// Per row: dropdown of active projects + a Connect button. On success the row
// drops out of the list (via router refresh from connectGroupToProject's
// revalidatePath("/inbox")).

export type OrphanGroupRow = {
  id: string;
  groupChatId: string;
  groupName: string | null;
  createdAt: string; // ISO so the server→client boundary serializes cleanly
};

type DealOption = { id: string; name: string };

export function OrphanGroupsSection({
  orphans,
  deals
}: {
  orphans: OrphanGroupRow[];
  deals: DealOption[];
}) {
  // Empty list means either no inbound group yet or every one has been wired.
  // Hide the panel entirely in that case — keeps /inbox visually quiet until
  // there's something actionable.
  if (orphans.length === 0) return null;

  return (
    <section className="rounded-md border bg-amber-50/40 dark:bg-amber-500/5">
      <header className="flex items-center justify-between border-b border-amber-200/60 bg-amber-100/60 px-3 py-1.5 dark:border-amber-500/20 dark:bg-amber-500/10">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
          <Link2 className="size-3.5" />
          קבוצות WhatsApp ממתינות לקישור
        </h2>
        <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          {orphans.length}
        </span>
      </header>
      <ul className="divide-y divide-amber-200/60 dark:divide-amber-500/20">
        {orphans.map((g) => (
          <OrphanRow key={g.id} group={g} deals={deals} />
        ))}
      </ul>
    </section>
  );
}

function OrphanRow({
  group,
  deals
}: {
  group: OrphanGroupRow;
  deals: DealOption[];
}) {
  const [dealId, setDealId] = useState<string>("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onConnect = () => {
    if (!dealId) {
      setError("בחר פרויקט מהרשימה");
      return;
    }
    const label = group.groupName ?? group.groupChatId;
    const dealName = deals.find((d) => d.id === dealId)?.name ?? "";
    if (!window.confirm(`לחבר את "${label}" לפרויקט "${dealName}"?`)) return;
    setError(null);
    startTransition(async () => {
      const r = await connectGroupToProject({ groupId: group.id, masterDealId: dealId });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
    });
  };

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2",
        done && "opacity-60"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium">
          {group.groupName ?? "(ללא שם)"}
        </div>
        <div className="text-[10px] text-muted-foreground" dir="ltr">
          {group.groupChatId}
        </div>
        <div className="text-[10px] text-muted-foreground">
          התקבלה: {formatDate(group.createdAt)}
        </div>
      </div>
      <select
        value={dealId}
        onChange={(e) => {
          setError(null);
          setDealId(e.target.value);
        }}
        disabled={pending || done}
        className="min-w-[160px] rounded border border-input bg-background px-2 py-1 text-[11px]"
      >
        <option value="">— בחר פרויקט —</option>
        {deals.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onConnect}
        disabled={pending || done || !dealId}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="size-3" />
        ) : (
          <Link2 className="size-3" />
        )}
        {done ? "חובר" : "חבר"}
      </button>
      {error && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle className="size-3" />
          {error}
        </span>
      )}
    </li>
  );
}
