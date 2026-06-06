import { Check, Clock, AlertTriangle } from "lucide-react";
import type { AuthorityReadiness } from "@/lib/portal-authority-scan";
import { cn } from "@/lib/utils";

// Block 39 — readiness meter row.
//
// One card per detected authority. Server component (no interactivity);
// authorities not represented in the permit don't render, so the row
// grows organically with the permit's scope.

export function PortalAuthorityTrafficLight({
  authorities
}: {
  authorities: AuthorityReadiness[];
}) {
  if (authorities.length === 0) return null;

  return (
    <section className="rounded-md border bg-card px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          לוח סטטוס רשויות
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {authorities.filter((a) => a.status === "READY").length}/{authorities.length} אושרו
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {authorities.map((a) => (
          <li key={a.key}>
            <AuthorityCard a={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AuthorityCard({ a }: { a: AuthorityReadiness }) {
  const tone = STYLE[a.status];
  const Icon = ICONS[a.status];
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px]",
        tone.container
      )}
      title={`${a.label} — ${tone.title} (${a.completedCount}/${a.totalCount})`}
    >
      <span className="text-[15px] leading-none">{a.emoji}</span>
      <div className="flex flex-col gap-0">
        <span className="font-semibold leading-tight">{a.label}</span>
        <span className={cn("flex items-center gap-0.5 text-[10px] leading-tight", tone.subtle)}>
          <Icon className="size-2.5" />
          {tone.shortLabel}
          <span className="ms-1 tabular-nums">
            {a.completedCount}/{a.totalCount}
          </span>
        </span>
      </div>
    </div>
  );
}

const ICONS = {
  READY: Check,
  IN_PROGRESS: Clock,
  BLOCKED: AlertTriangle
};

const STYLE = {
  READY: {
    title: "אושר",
    shortLabel: "אושר",
    container:
      "border-emerald-500/50 bg-emerald-50/70 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100",
    subtle: "text-emerald-700 dark:text-emerald-300"
  },
  IN_PROGRESS: {
    title: "בטיפול",
    shortLabel: "בטיפול",
    container:
      "border-amber-500/50 bg-amber-50/70 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100",
    subtle: "text-amber-700 dark:text-amber-300"
  },
  BLOCKED: {
    title: "חסום",
    shortLabel: "חסום",
    container:
      "border-red-500/50 bg-red-50/70 text-red-900 dark:bg-red-500/10 dark:text-red-100",
    subtle: "text-red-700 dark:text-red-300"
  }
} as const;
