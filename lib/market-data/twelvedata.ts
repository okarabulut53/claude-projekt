import { PricePoint } from "@/lib/types";
import { markTwelveDataRateLimited, runTwelveDataRateLimited } from "./rateLimitQueue";

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE = "https://api.twelvedata.com";

export function isTwelveDataConfigured() {
  return Boolean(TD_KEY);
}

interface TimeSeriesResponse {
  status?: string;
  values?: { datetime: string; close: string }[];
}

export interface TwelveDataOhlcvBar {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface OhlcvTimeSeriesResponse {
  status?: string;
  code?: number;
  message?: string;
  values?: TwelveDataOhlcvBar[];
}

export type TwelveDataOhlcvResult =
  | { ok: true; bars: TwelveDataOhlcvBar[] }
  | { ok: false; reason: "rate_limit" | "not_found" | "unconfigured" | "error" };

/**
 * Full OHLCV bars (for the candlestick chart), as opposed to fetchTwelveDataHistory's
 * close-only daily series used by the existing sparkline/LineChart callers. `interval`
 * is a Twelve Data interval string (e.g. "5min", "1h", "1day", "1month" — see
 * https://twelvedata.com/docs#time-series). Same free-tier rate limits apply (8 req/min,
 * 800/day) — returns a distinct "rate_limit" reason instead of throwing so callers can
 * show a message instead of crashing; cache aggressively like every other
 * lib/market-data/* call.
 */
export async function fetchTwelveDataOhlcv(
  symbol: string,
  interval: string,
  outputsize = 200,
): Promise<TwelveDataOhlcvResult> {
  if (!TD_KEY) return { ok: false, reason: "unconfigured" };
  try {
    const res = await runTwelveDataRateLimited(() =>
      fetch(`${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TD_KEY}`),
    );
    const data: OhlcvTimeSeriesResponse = await res.json();
    if (res.status === 429 || data.code === 429) {
      markTwelveDataRateLimited();
      return { ok: false, reason: "rate_limit" };
    }
    if (data.status === "error" || !Array.isArray(data.values) || data.values.length === 0) {
      return { ok: false, reason: "not_found" };
    }
    return { ok: true, bars: data.values };
  } catch {
    return { ok: false, reason: "error" };
  }
}

export class TwelveDataRateLimitError extends Error {}
export class TwelveDataUnavailableError extends Error {}

/**
 * Same as fetchTwelveDataOhlcv, but throws instead of returning a discriminated result —
 * for callers that already use the cached() "serve stale value on throw" pattern
 * (lib/market-data/cache.ts) and want a failed fetch to fall through to that, rather than
 * accidentally caching an error response as if it were real data.
 */
export async function fetchTwelveDataOhlcvOrThrow(
  symbol: string,
  interval: string,
  outputsize = 200,
): Promise<TwelveDataOhlcvBar[]> {
  const result = await fetchTwelveDataOhlcv(symbol, interval, outputsize);
  if (result.ok) return result.bars;
  if (result.reason === "rate_limit") throw new TwelveDataRateLimitError();
  throw new TwelveDataUnavailableError(result.reason);
}

/**
 * Daily close history. Free tier is capped at 8 requests/minute, so callers
 * must cache this aggressively (hours, not seconds) — see lib/mock/instruments.ts.
 */
export async function fetchTwelveDataHistory(symbol: string, days = 90): Promise<PricePoint[] | null> {
  if (!TD_KEY) return null;
  try {
    const res = await runTwelveDataRateLimited(() =>
      fetch(`${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${days}&apikey=${TD_KEY}`),
    );
    if (res.status === 429) {
      markTwelveDataRateLimited();
      return null;
    }
    if (!res.ok) return null;
    const data: TimeSeriesResponse = await res.json();
    if (data.status === "error" || !Array.isArray(data.values) || data.values.length === 0) return null;
    return data.values
      .map((v) => ({ date: new Date(v.datetime).toISOString(), price: Number(v.close) }))
      .reverse();
  } catch {
    return null;
  }
}
