// Best-effort in-memory rate limiter for the handful of server actions that
// are reachable WITHOUT a session (public /quote/[id] signing, /m/[token]
// field uploads). Not a substitute for a real distributed limiter — each
// Vercel serverless instance keeps its own bucket map, so a determined
// attacker spread across instances/regions isn't fully blocked. But it
// raises the cost of casual brute-forcing / scripted abuse against routes
// whose only "auth" is an unguessable-but-not-infinite token/cuid.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Periodically drop expired buckets so this doesn't grow unbounded across a
// long-lived instance. Cheap: only runs when a bucket is touched.
function sweep(now: number) {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  if (buckets.size > 5000) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= opts.limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000)
    };
  }
  existing.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

// Reads the caller's IP from forwarded headers (same precedence used
// elsewhere in the app — see app/actions/proposals-public.ts).
export function getRequestIp(h: Headers): string {
  const xff = h.get("x-forwarded-for") || "";
  return (xff.split(",")[0] || h.get("x-real-ip") || "").trim() || "unknown";
}
