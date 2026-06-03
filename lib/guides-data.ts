import { readFileSync } from "node:fs";
import { join } from "node:path";

// Registry of in-app guides. Each entry points to a Markdown file under docs/
// — the file is the single source of truth, shared between the in-app
// /guides reader and the docs/ directory visible on GitHub. To add a new
// guide: drop a new .md under docs/guides/ and append an entry below.
//
// Files are read synchronously when the module is first imported on the
// server. Vercel's lambda bundler picks them up via `outputFileTracingIncludes`
// in next.config.mjs. The reader is memoized via the module-level cache below.

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  /** Visual icon hint — maps to a lucide-react icon in the index page. */
  iconKey:
    | "rocket"
    | "clipboard"
    | "wallet"
    | "message-circle"
    | "list-checks"
    | "settings";
  /** Path relative to the project root, e.g. "docs/guides/01-quick-start.md". */
  file: string;
  /** ISO date string, e.g. "2026-06-03". */
  updatedAt: string;
};

export const GUIDES: GuideMeta[] = [
  {
    slug: "quick-start",
    title: "התחלה מהירה",
    description:
      "סקירת המערכת, ההיררכיה (לקוח → פרויקט → היתר → בניין), 4 התפקידים ומה כל אחד רואה. נקודת הכניסה הטובה ביותר למשתמש חדש.",
    iconKey: "rocket",
    file: "docs/guides/01-quick-start.md",
    updatedAt: "2026-06-03"
  },
  {
    slug: "form-4-end-to-end",
    title: "טופס 4 — תהליך מקצה לקצה",
    description:
      "התהליך המלא של הוצאת טופס 4 / תעודת גמר: יצירת פרויקט והיתר, ניהול משימות לפי קטגוריות, מעקב הגשות לרשות, וסגירה.",
    iconKey: "clipboard",
    file: "docs/guides/02-form-4-end-to-end.md",
    updatedAt: "2026-06-03"
  },
  {
    slug: "finances",
    title: "כספים — אבני דרך ועמלות",
    description:
      "אבני דרך לחיוב (מבוסס משימה / מבוסס אחוז), שולם/חייב, ייצוא Excel, וטיפול בעמלות מספקים (Block 27).",
    iconKey: "wallet",
    file: "docs/guides/03-finances.md",
    updatedAt: "2026-06-03"
  },
  {
    slug: "whatsapp",
    title: "WhatsApp ב-ERP",
    description:
      "תיבת WhatsApp (מסמכים נכנסים), קבוצות פרויקט ושיוך הודעות, תזכורות יוצאות דרך Green API + wa.me, הרשאות פרטיות ללקוחות.",
    iconKey: "message-circle",
    file: "docs/guides/04-whatsapp.md",
    updatedAt: "2026-06-03"
  },
  {
    slug: "my-tasks-productivity",
    title: "המשימות שלי + כלי תפוקה",
    description:
      "התיבה האישית של ה-PM: סינון, Kanban, עריכה בשורה, snooze, Command Palette (⌘K), Scratchpad, ותזכורות WhatsApp.",
    iconKey: "list-checks",
    file: "docs/guides/05-my-tasks-productivity.md",
    updatedAt: "2026-06-03"
  },
  {
    slug: "settings-admin",
    title: "הגדרות והרשאות",
    description:
      "ניהול משתמשים וסיסמאות, רשויות ו-Wiki, תבניות משימות, סוגי בניינים, סל מיחזור, ויומן פעולות (Audit Log).",
    iconKey: "settings",
    file: "docs/guides/06-settings-admin.md",
    updatedAt: "2026-06-03"
  }
];

const CACHE = new Map<string, string>();

export function getGuideBySlug(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function readGuideContent(meta: GuideMeta): string {
  const cached = CACHE.get(meta.slug);
  if (cached !== undefined) return cached;
  const absolute = join(process.cwd(), meta.file);
  const content = readFileSync(absolute, "utf-8");
  CACHE.set(meta.slug, content);
  return content;
}
