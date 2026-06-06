import type { TaskStatus } from "@prisma/client";

// Block 39 (Smart Portal Dashboard) — scan a permit's tasks for the
// bracketed authority tags embedded in task names ("[כיבוי אש] ...") and
// roll them up into a per-authority readiness summary.
//
// Tag detection is the same plain-substring scan used by lib/task-emoji
// at render time — we don't fetch from the DB, the source of truth is the
// task name as imported from the Excel template. Authorities not present
// in the permit's task list don't appear in the result, so the traffic
// light grows organically with the project rather than showing dead
// rows for departments the permit doesn't go through.

export type AuthorityKey =
  | "HOMEFRONT_COMMAND"   // הג"א
  | "FIRE_DEPARTMENT"     // כיבוי אש
  | "WATER_AUTHORITY"     // יובלים / תאגיד מים
  | "ELECTRIC_COMPANY"    // חברת חשמל
  | "FORMS";              // טפסים

export type AuthorityReadinessStatus = "READY" | "IN_PROGRESS" | "BLOCKED";

export type AuthorityReadiness = {
  key: AuthorityKey;
  label: string;
  emoji: string;
  // Status rules:
  //   * READY        — every matched task is COMPLETED.
  //   * IN_PROGRESS  — at least one task is OPEN / IN_PROGRESS /
  //                     AWAITING_AUTHORITY (work is moving).
  //   * BLOCKED      — at least one BLOCKED task and none active.
  status: AuthorityReadinessStatus;
  completedCount: number;
  totalCount: number;
};

type RuleConfig = {
  key: AuthorityKey;
  label: string;
  emoji: string;
  needles: string[];
};

// Needles are matched as plain substrings against the task's name AND
// category field. Real Excel imports park the authority on `category`
// ("הג\"א", "תאגיד מים — מני\"ב"), while older seeds used bracketed
// tags inside the name (`[הג"א]` etc.) — we cover both forms so the
// traffic light works regardless of intake path. Gershayim variants
// ('הג"א' / 'הג״א') both ship in real data, hence the duplicates.
const RULES: RuleConfig[] = [
  {
    key: "HOMEFRONT_COMMAND",
    label: "הג\"א",
    emoji: "🪖",
    needles: ["הג\"א", "הג״א"]
  },
  {
    key: "FIRE_DEPARTMENT",
    label: "כיבוי אש",
    emoji: "🚒",
    needles: ["כיבוי אש"]
  },
  {
    key: "WATER_AUTHORITY",
    label: "תאגיד מים",
    emoji: "💧",
    needles: ["יובלים", "תאגיד מים", "תאגיד-", "מני\"ב", "מני״ב"]
  },
  {
    key: "ELECTRIC_COMPANY",
    label: "חברת חשמל",
    emoji: "⚡",
    needles: ["חברת חשמל", "חח\"י", "חח״י"]
  },
  {
    key: "FORMS",
    label: "טפסים",
    emoji: "📄",
    needles: ["טפסים", "טפסי פיקוח"]
  }
];

type TaskLike = { name: string; status: TaskStatus; category: string | null };

export function scanPermitAuthorities(tasks: TaskLike[]): AuthorityReadiness[] {
  const out: AuthorityReadiness[] = [];
  for (const rule of RULES) {
    const matched = tasks.filter((t) => {
      const haystack = `${t.name}​${t.category ?? ""}`;
      return rule.needles.some((n) => haystack.includes(n));
    });
    if (matched.length === 0) continue;

    const completed = matched.filter((t) => t.status === "COMPLETED").length;
    const anyActive = matched.some(
      (t) =>
        t.status === "OPEN" ||
        t.status === "IN_PROGRESS" ||
        t.status === "AWAITING_AUTHORITY"
    );
    let status: AuthorityReadinessStatus;
    if (completed === matched.length) {
      status = "READY";
    } else if (anyActive) {
      status = "IN_PROGRESS";
    } else {
      // Only BLOCKED tasks left and none active — surfaces as red so the
      // PM / client knows the chain is stuck rather than just "in progress".
      status = "BLOCKED";
    }

    out.push({
      key: rule.key,
      label: rule.label,
      emoji: rule.emoji,
      status,
      completedCount: completed,
      totalCount: matched.length
    });
  }
  return out;
}
