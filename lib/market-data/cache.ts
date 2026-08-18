const store = new Map<string, { value: unknown; expiresAt: number }>();

/**
 * TTL cache for external API calls. On fetch failure, serves a stale cached
 * value if one exists instead of throwing — Twelve Data / Finnhub free tiers
 * are rate-limited and occasionally flaky, and a stale price beats no price.
 */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  try {
    const value = await fetcher();
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  } catch (err) {
    if (hit) return hit.value as T;
    throw err;
  }
}
