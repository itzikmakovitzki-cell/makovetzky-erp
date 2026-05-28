// Deterministic per-project color coding. Hashing the permit id to a fixed
// palette gives every project a stable visual identity across the table, the
// Kanban board, and the personal inbox — users learn "the blue one is Ushishkin"
// at a glance. Class strings are written as full literals so Tailwind's source
// scanner keeps them in the build (never compose color classes dynamically).

export type ProjectColor = {
  /** Badge classes: light fill + readable text + subtle border. */
  badge: string;
  /** Solid dot/accent for cards and avatars. */
  dot: string;
  /** Left-border accent for Kanban cards. */
  bar: string;
};

const PALETTE: ProjectColor[] = [
  { badge: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-500", bar: "border-s-blue-400" },
  { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500", bar: "border-s-emerald-400" },
  { badge: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-500", bar: "border-s-violet-400" },
  { badge: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-500", bar: "border-s-rose-400" },
  { badge: "bg-cyan-100 text-cyan-800 border-cyan-200", dot: "bg-cyan-500", bar: "border-s-cyan-400" },
  { badge: "bg-indigo-100 text-indigo-800 border-indigo-200", dot: "bg-indigo-500", bar: "border-s-indigo-400" },
  { badge: "bg-teal-100 text-teal-800 border-teal-200", dot: "bg-teal-500", bar: "border-s-teal-400" },
  { badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200", dot: "bg-fuchsia-500", bar: "border-s-fuchsia-400" },
  { badge: "bg-lime-100 text-lime-800 border-lime-200", dot: "bg-lime-600", bar: "border-s-lime-400" },
  { badge: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-500", bar: "border-s-sky-400" },
  { badge: "bg-pink-100 text-pink-800 border-pink-200", dot: "bg-pink-500", bar: "border-s-pink-400" },
  { badge: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-500", bar: "border-s-purple-400" }
];

// FNV-ish string hash → stable non-negative integer.
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function projectColor(id: string): ProjectColor {
  if (!id) return PALETTE[0];
  return PALETTE[hashString(id) % PALETTE.length];
}
