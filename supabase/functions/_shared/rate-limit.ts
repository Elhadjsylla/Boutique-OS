// Sliding-window rate limiter.
// Tries Deno KV first (globally consistent across instances).
// Falls back to an in-memory Map if KV is unavailable (per-instance, best-effort).

const memCache = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean }> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const kv = await Deno.openKv();
    const windowSlot = Math.floor(now / windowMs);
    const kvKey = ["rl", key, windowSlot];

    const entry = await kv.get<number>(kvKey);
    const count = entry.value ?? 0;

    if (count >= maxRequests) return { allowed: false };

    // expireIn 2× window so the key outlives the slot and gets GC'd naturally
    await kv.set(kvKey, count + 1, { expireIn: windowMs * 2 });
    return { allowed: true };

  } catch {
    // Deno KV unavailable — use in-memory fallback (per cold-start)
    const entry = memCache.get(key);

    if (!entry || now > entry.resetAt) {
      memCache.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (entry.count >= maxRequests) return { allowed: false };

    entry.count++;
    return { allowed: true };
  }
}
