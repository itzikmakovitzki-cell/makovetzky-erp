"use client";

import { useState, useTransition } from "react";
import { AuthoritySubmissionStatus } from "@prisma/client";
import { ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { transitionAuthoritySubmission } from "@/app/actions/authority-submissions";
import { cn } from "@/lib/utils";

// Block 26: strip of per-category submission pills above the tasks table.
// One pill per distinct Task.category present on the permit. Clicking opens
// a compact action menu that lets the admin transition the submission's
// lifecycle (PREPARING → SUBMITTED → APPROVED/REJECTED). On SUBMITTED the
// server action also bulk-flips category tasks to AWAITING_AUTHORITY+frozen
// so Bat-Or doesn't have to do it by hand.

type Submission = {
  category: string;
  status: AuthoritySubmissionStatus;
  submittedAt: Date | null;
  decidedAt: Date | null;
  decisionNotes: string | null;
};

const STATUS_LABEL: Record<AuthoritySubmissionStatus, string> = {
  PREPARING: "באיסוף",
  SUBMITTED: "ממתין לרשות",
  APPROVED: "אושר ע״י הרשות",
  REJECTED: "נדחה ע״י הרשות"
};

const STATUS_TONE: Record<AuthoritySubmissionStatus, string> = {
  PREPARING: "bg-zinc-100 text-zinc-700 border-zinc-200",
  SUBMITTED: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-red-50 text-red-800 border-red-200"
};

const NEXT_OPTIONS: Record<AuthoritySubmissionStatus, AuthoritySubmissionStatus[]> = {
  PREPARING: ["SUBMITTED"],
  SUBMITTED: ["APPROVED", "REJECTED", "PREPARING"],
  APPROVED: ["PREPARING"],
  REJECTED: ["SUBMITTED", "PREPARING"]
};

export type CategoryCompletion = {
  // Total non-deleted tasks in the category.
  total: number;
  // Of those, how many have status === COMPLETED.
  completed: number;
};

export function AuthoritySubmissionsStrip({
  permitId,
  categories,
  submissions,
  completionByCategory
}: {
  permitId: string;
  // Every category present on the permit's tasks. Order is server-controlled
  // (sorted asc).
  categories: string[];
  // Existing submission rows. Categories without a row implicitly = PREPARING.
  submissions: Submission[];
  // n-of-m completion stats per category — drives the "X/Y" hint on each
  // pill and the confirm dialog when SUBMITTED is clicked with X < Y.
  completionByCategory: Record<string, CategoryCompletion>;
}) {
  if (categories.length === 0) return null;

  const byCategory = new Map(submissions.map((s) => [s.category, s]));

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        הגשות לרשות
      </span>
      {categories.map((category) => (
        <SubmissionPill
          key={category}
          permitId={permitId}
          category={category}
          submission={byCategory.get(category) ?? null}
          completion={completionByCategory[category] ?? { total: 0, completed: 0 }}
        />
      ))}
    </div>
  );
}

function SubmissionPill({
  permitId,
  category,
  submission,
  completion
}: {
  permitId: string;
  category: string;
  submission: Submission | null;
  completion: CategoryCompletion;
}) {
  const status: AuthoritySubmissionStatus = submission?.status ?? "PREPARING";
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transition(nextStatus: AuthoritySubmissionStatus, decisionNotes?: string) {
    setError(null);

    // Completion gate: if the admin is moving to SUBMITTED but the category
    // still has un-completed tasks, surface a confirm dialog so a misclick
    // doesn't freeze work-in-progress (which is exactly the bug that bit us
    // on Hana Rovina and got fixed in PR #43).
    if (nextStatus === "SUBMITTED" && completion.completed < completion.total) {
      const remaining = completion.total - completion.completed;
      const proceed = window.confirm(
        `יש עוד ${remaining} משימות לא הושלמו בקטגוריה "${category}" (${completion.completed}/${completion.total}).\n\nאם תמשיך — כל המשימות הפעילות בקטגוריה ייכנסו ל"ממתין לרשות" ויוקפאו.\n\nלהמשיך בכל זאת?`
      );
      if (!proceed) return;
    }

    const fd = new FormData();
    fd.append("permitId", permitId);
    fd.append("category", category);
    fd.append("nextStatus", nextStatus);
    if (decisionNotes) fd.append("decisionNotes", decisionNotes);

    startTransition(async () => {
      const res = await transitionAuthoritySubmission(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMenuOpen(false);
    });
  }

  const date =
    status === "SUBMITTED" && submission?.submittedAt
      ? formatDate(submission.submittedAt)
      : (status === "APPROVED" || status === "REJECTED") && submission?.decidedAt
        ? formatDate(submission.decidedAt)
        : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
          STATUS_TONE[status]
        )}
        title={submission?.decisionNotes ?? undefined}
      >
        <span className="font-medium">{category}</span>
        {completion.total > 0 && (
          <span
            className={cn(
              "text-[10px] tabular-nums",
              completion.completed === completion.total
                ? "opacity-80"
                : "opacity-60"
            )}
            title={`${completion.completed} מתוך ${completion.total} משימות הושלמו`}
          >
            {completion.completed}/{completion.total}
          </span>
        )}
        <span className="text-[10px] opacity-80">·</span>
        <span>{STATUS_LABEL[status]}</span>
        {date && <span className="text-[10px] opacity-70">· {date}</span>}
        {pending ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>
      {menuOpen && (
        <SubmissionMenu
          currentStatus={status}
          onTransition={transition}
          onClose={() => setMenuOpen(false)}
          pending={pending}
          error={error}
          decisionNotes={submission?.decisionNotes ?? ""}
        />
      )}
    </div>
  );
}

function SubmissionMenu({
  currentStatus,
  onTransition,
  onClose,
  pending,
  error,
  decisionNotes: initialNotes
}: {
  currentStatus: AuthoritySubmissionStatus;
  onTransition: (next: AuthoritySubmissionStatus, decisionNotes?: string) => void;
  onClose: () => void;
  pending: boolean;
  error: string | null;
  decisionNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const options = NEXT_OPTIONS[currentStatus];

  return (
    <div
      className="absolute end-0 top-full z-30 mt-1 w-64 rounded-md border bg-popover p-2 text-[12px] shadow-lg"
      role="menu"
    >
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        העברה לסטטוס
      </div>
      <div className="flex flex-col gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={pending}
            onClick={() => onTransition(opt, notes.trim() || undefined)}
            className={cn(
              "rounded px-2 py-1 text-start text-[12px] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
              STATUS_TONE[opt].replace(/border-\S+/g, "")
            )}
          >
            {STATUS_LABEL[opt]}
          </button>
        ))}
      </div>
      {(currentStatus === "SUBMITTED" || options.includes("APPROVED") || options.includes("REJECTED")) && (
        <div className="mt-2">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              הערה (לא חובה)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-0.5 w-full resize-none rounded border border-input bg-background px-1.5 py-1 text-[11px]"
              placeholder="לדוגמה: חסר טופס X"
            />
          </label>
        </div>
      )}
      {error && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle className="size-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        >
          סגור
        </button>
      </div>
    </div>
  );
}

function formatDate(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
