const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8; // Twelve Data free tier: 8 requests/minute.

let requestTimestamps: number[] = [];
let queueTail: Promise<void> = Promise.resolve();
let lastRateLimitHitAt: number | null = null;

function pruneExpired(now: number) {
  requestTimestamps = requestTimestamps.filter((t) => now - t < WINDOW_MS);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    pruneExpired(now);
    if (requestTimestamps.length < MAX_REQUESTS_PER_WINDOW) {
      requestTimestamps.push(now);
      return;
    }
    const oldest = requestTimestamps[0];
    await delay(Math.max(oldest + WINDOW_MS - now, 50));
  }
}

/**
 * Runs `fn` after acquiring one of at most 8 slots in a rolling 60s window, shared across every
 * caller in this Node process — matches Twelve Data's free-tier rate limit. Without this,
 * concurrent callers (multiple watchlistOnly=true rankings, several users active at once, a cold
 * cache after a 6h TTL expiry) each fire their own fetches in parallel and blow past the limit
 * even though every individual call site already caches its own result (lib/market-data/cache.ts
 * only prevents *repeat* calls for the same key, not concurrent calls for *different* keys).
 *
 * FIFO by construction: `queueTail` is reassigned synchronously on every call, so a call made
 * later always chains after one made earlier, even when several calls are issued in the same
 * synchronous block (e.g. Promise.all over a candidate list).
 */
export function runTwelveDataRateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const runAfterSlot = queueTail.then(acquireSlot);
  queueTail = runAfterSlot.catch(() => undefined);
  return runAfterSlot.then(fn);
}

/** Call when Twelve Data itself reports a 429/rate-limit response, despite the queue above —
 *  e.g. another process shares the same API key, or a burst still lands two calls in the same
 *  provider-side window. Lets tools.ts surface an honest note instead of silently degrading. */
export function markTwelveDataRateLimited() {
  lastRateLimitHitAt = Date.now();
}

/** True if a rate-limit response was seen recently (default: within the last 90s). */
export function wasTwelveDataRateLimitedRecently(withinMs = 90_000): boolean {
  return lastRateLimitHitAt !== null && Date.now() - lastRateLimitHitAt < withinMs;
}

/** Test-only: resets all module-level state between test cases. */
export function __resetTwelveDataRateLimitStateForTests() {
  requestTimestamps = [];
  queueTail = Promise.resolve();
  lastRateLimitHitAt = null;
}

const FMP_DAILY_LIMIT = 250; // Financial Modeling Prep free tier: 250 requests/day, resets at UTC midnight.

let fmpRequestCount = 0;
let fmpRequestDay = utcDay();

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetFmpCounterIfNewDay() {
  const day = utcDay();
  if (day !== fmpRequestDay) {
    fmpRequestDay = day;
    fmpRequestCount = 0;
  }
}

/** Thrown by lib/data-providers/fmp.ts's fmpGet instead of returning null, so that
 *  lib/market-data/cache.ts's cached() (which only serves/records a stale value on throw, not on
 *  a null return) doesn't accidentally memoize "not available" for 6h just because the daily FMP
 *  quota was briefly exhausted — a plain null return would get cached exactly like a genuine
 *  missing-data result. Callers in tools.ts must catch this specifically and surface the
 *  quota-exhausted chat message instead of the normal "nicht verfügbar" one. */
export class FmpDailyLimitReachedError extends Error {
  constructor() {
    super("FMP daily request limit reached");
    this.name = "FmpDailyLimitReachedError";
  }
}

/** Reserves one of FMP's 250 free-tier daily requests (UTC calendar day, matching FMP's own reset
 *  schedule). Throws FmpDailyLimitReachedError once the quota is exhausted — see the class doc
 *  above for why this throws instead of returning a boolean. */
export function reserveFmpDailyRequest(): void {
  resetFmpCounterIfNewDay();
  if (fmpRequestCount >= FMP_DAILY_LIMIT) throw new FmpDailyLimitReachedError();
  fmpRequestCount += 1;
}

/** Human-readable reset time for the chat error message — next UTC midnight. */
export function fmpDailyResetLabel(): string {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(0, 0, 0, 0);
  return `${next.toISOString().slice(11, 16)} UTC`;
}

/** Test-only: resets FMP daily-counter state between test cases. */
export function __resetFmpRateLimitStateForTests() {
  fmpRequestCount = 0;
  fmpRequestDay = utcDay();
}
