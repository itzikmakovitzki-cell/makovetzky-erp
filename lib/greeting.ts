// Time-of-day greeting helpers, extracted from /my-tasks (Block 25) so the
// dashboard can reuse them without duplicating the timezone logic.
//
// The greeting is computed in Israel time — server runs in UTC on Vercel
// (fra1), but Bat-Or's "בוקר טוב" needs to match her wall clock, not the
// data centre's.

export function israelHour(now: Date): number {
  const s = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hour12: false
  }).format(now);
  const h = Number(s);
  return Number.isFinite(h) ? h % 24 : now.getHours();
}

export function greetingForHour(h: number): {
  greeting: string;
  emoji: string;
} {
  if (h >= 5 && h < 12) return { greeting: "בוקר טוב", emoji: "☕" };
  if (h >= 12 && h < 17) return { greeting: "צהריים טובים", emoji: "☀️" };
  if (h >= 17 && h < 21) return { greeting: "ערב טוב", emoji: "🌆" };
  return { greeting: "לילה טוב", emoji: "🌙" };
}
