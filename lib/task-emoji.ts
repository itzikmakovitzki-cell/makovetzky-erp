// Block 25: surface the bureaucratic authority a task belongs to with a
// glanceable emoji, derived from the bracketed tag embedded in the task name
// (the Excel import keeps these like `[הג"א] הגשת תוכנית`). First match wins.

type EmojiRule = { emoji: string; needles: string[] };

// Needles are matched as plain substrings of the task name. Hebrew gershayim
// shows up as both a straight quote (") and the geresh (״), so list both.
const RULES: EmojiRule[] = [
  { emoji: "🪖", needles: ['[הג"א]', "[הג״א]"] },
  { emoji: "🚒", needles: ["[כיבוי אש]"] },
  { emoji: "💧", needles: ["[יובלים]", "[תאגיד מים]"] },
  { emoji: "📄", needles: ["[טפסים]"] }
];

export function taskEmoji(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const rule of RULES) {
    for (const needle of rule.needles) {
      if (name.includes(needle)) return rule.emoji;
    }
  }
  return null;
}
