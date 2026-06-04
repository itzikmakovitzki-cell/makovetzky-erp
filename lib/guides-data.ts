import { readFileSync } from "node:fs";
import { join } from "node:path";

// Registry of in-app guides. Each entry points to a Markdown file under docs/
// — the file is the single source of truth, shared between the in-app
// /guides reader and the docs/ directory visible on GitHub. To add a new
// guide: drop a new .md under docs/guides/ and append an entry below.
//
// Two guide categories:
//   - "main"   — the long-form walkthroughs (quick-start, form-4, finances, ...)
//   - "howto"  — short focused pocket guides ("how do I X?")
//
// Files are read synchronously when the module is first imported on the
// server. Vercel's lambda bundler picks them up via `outputFileTracingIncludes`
// in next.config.mjs. The reader is memoized via the module-level cache below.

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  /** Group in the /guides index. */
  category: "main" | "howto";
  /** Visual icon hint — maps to a lucide-react icon in the index page. */
  iconKey:
    | "rocket"
    | "clipboard"
    | "wallet"
    | "message-circle"
    | "list-checks"
    | "settings"
    | "plus-circle"
    | "send"
    | "file-spreadsheet"
    | "layers"
    | "link"
    | "coins"
    | "search"
    | "check-square";
  /** Path relative to the project root, e.g. "docs/guides/01-quick-start.md". */
  file: string;
  /** ISO date string, e.g. "2026-06-04". */
  updatedAt: string;
};

export const GUIDES: GuideMeta[] = [
  // ─── Main guides ──────────────────────────────────────────────────────
  {
    slug: "quick-start",
    title: "התחלה מהירה",
    description:
      "סקירת המערכת, ההיררכיה (לקוח → פרויקט → היתר → בניין), 4 התפקידים ומה כל אחד רואה. נקודת הכניסה הטובה ביותר למשתמש חדש.",
    category: "main",
    iconKey: "rocket",
    file: "docs/guides/01-quick-start.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "form-4-end-to-end",
    title: "טופס 4 — תהליך מקצה לקצה",
    description:
      "התהליך המלא של הוצאת טופס 4 / תעודת גמר: יצירת פרויקט והיתר, ניהול משימות לפי קטגוריות, מעקב הגשות לרשות, וסגירה.",
    category: "main",
    iconKey: "clipboard",
    file: "docs/guides/02-form-4-end-to-end.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "finances",
    title: "כספים — אבני דרך ועמלות",
    description:
      "אבני דרך לחיוב (מבוסס משימה / מבוסס אחוז), שולם/חייב, ייצוא Excel, וטיפול בעמלות מספקים.",
    category: "main",
    iconKey: "wallet",
    file: "docs/guides/03-finances.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "whatsapp",
    title: "WhatsApp ב-ERP",
    description:
      "תיבת WhatsApp (מסמכים נכנסים), קבוצות פרויקט ושיוך הודעות, תזכורות יוצאות דרך Green API + wa.me, הרשאות פרטיות ללקוחות.",
    category: "main",
    iconKey: "message-circle",
    file: "docs/guides/04-whatsapp.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "my-tasks-productivity",
    title: "המשימות שלי + כלי תפוקה",
    description:
      "התיבה האישית של ה-PM: סינון, Kanban, עריכה בשורה, snooze, Command Palette (⌘K), Scratchpad, ותזכורות WhatsApp.",
    category: "main",
    iconKey: "list-checks",
    file: "docs/guides/05-my-tasks-productivity.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "settings-admin",
    title: "הגדרות והרשאות",
    description:
      "ניהול משתמשים וסיסמאות, רשויות ו-Wiki, תבניות משימות, סוגי בניינים, סל מיחזור, ויומן פעולות (Audit Log).",
    category: "main",
    iconKey: "settings",
    file: "docs/guides/06-settings-admin.md",
    updatedAt: "2026-06-04"
  },

  // ─── How-to pocket guides ─────────────────────────────────────────────
  {
    slug: "howto-create-project",
    title: "איך יוצרים פרויקט חדש",
    description:
      "60 שניות, 6 שלבים — מטופס יחיד שיוצר לקוח + פרויקט + היתר + בניינים + משימות אוטומטיות.",
    category: "howto",
    iconKey: "plus-circle",
    file: "docs/guides/howto-01-create-project.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-whatsapp-reminder",
    title: "איך שולחים תזכורת WhatsApp לאחראי",
    description:
      "10 שניות, 2 לחיצות — הכפתור 📱 הירוק, הודעה מוכנה ל-clipboard, wa.me נפתח אוטומטית.",
    category: "howto",
    iconKey: "send",
    file: "docs/guides/howto-02-whatsapp-reminder.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-export-excel",
    title: "איך מייצאים ל-Excel",
    description:
      "איפה הכפתורים בכל מסך, מה מקבלים, איך הסטיילינג נראה — כולל דוח טופס 4 הסטנדרטי שלכם.",
    category: "howto",
    iconKey: "file-spreadsheet",
    file: "docs/guides/howto-03-export-excel.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-templates",
    title: "איך מגדירים תבניות משימות",
    description:
      "המנוע שייצור משימות אוטומטית בכל היתר חדש. צירוף רשות × סוג בניין, תלויות, ייבוא/ייצוא CSV.",
    category: "howto",
    iconKey: "layers",
    file: "docs/guides/howto-04-templates.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-magic-link",
    title: "איך משתמשים ב-Magic Link",
    description:
      "נותנים לעובד שטח להעלות מסמך בלי משתמש במערכת. 48 שעות תוקף, מרובה-שימוש, אנונימי.",
    category: "howto",
    iconKey: "link",
    file: "docs/guides/howto-05-magic-link.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-billing-milestone",
    title: "איך יוצרים אבן דרך לחיוב",
    description:
      "מתי לחייב את הלקוח — מבוסס משימה או מבוסס אחוז. מחזור חיים PENDING → DUE → PAID.",
    category: "howto",
    iconKey: "coins",
    file: "docs/guides/howto-06-billing-milestone.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-command-palette",
    title: "Command Palette — חיפוש מהיר",
    description:
      "מגיעים לכל לקוח/פרויקט/היתר ב-3 הקשות. ⌘K / Ctrl+K מכל מסך, ניווט במקלדת.",
    category: "howto",
    iconKey: "search",
    file: "docs/guides/howto-07-command-palette.md",
    updatedAt: "2026-06-04"
  },
  {
    slug: "howto-bulk-tasks",
    title: "איך משנים הרבה משימות במכה",
    description:
      "סינון + צ׳ק-בוקסים + סרגל פעולות צף. שינוי אחראי / סטטוס / מחיקה גורפת ל-50 משימות בלחיצה.",
    category: "howto",
    iconKey: "check-square",
    file: "docs/guides/howto-08-bulk-tasks.md",
    updatedAt: "2026-06-04"
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
