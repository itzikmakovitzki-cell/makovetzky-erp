import { readFileSync } from "node:fs";
import { join } from "node:path";

// Registry of in-app guides. Each entry points to a Markdown file under docs/
// — the file becomes the single source of truth, shared between the in-app
// /guides reader and the docs/ directory visible on GitHub. To add a new
// guide: drop a new .md under docs/ and append an entry below.
//
// Files are read synchronously when the module is first imported on the
// server. Vercel's lambda bundler picks them up via `outputFileTracingIncludes`
// in next.config.mjs. The reader is memoized via the module-level cache below.

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  /** Path relative to the project root, e.g. "docs/USER-GUIDE.md". */
  file: string;
  /** Author label shown on the index card. */
  author?: string;
  /** ISO date string, e.g. "2026-05-24". */
  updatedAt: string;
};

export const GUIDES: GuideMeta[] = [
  {
    slug: "system-overview",
    title: "מדריך מערכת כללי",
    description:
      "סקירת כל הפעולות במערכת לפי תפקיד — מנהל, עובד, קבלן ואורח עם קישור. כולל ספריית כל הפעולות, תהליכי עבודה ואינטגרציות.",
    file: "docs/USER-GUIDE.md",
    author: "צוות פיתוח",
    updatedAt: "2026-05-24"
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
