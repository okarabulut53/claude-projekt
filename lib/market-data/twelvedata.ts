import { PricePoint } from "@/lib/types";

const TD_KEY = process.env.TWELVE_DATA_API_KEY;
const BASE = "https://api.twelvedata.com";

export function isTwelveDataConfigured() {
  return Boolean(TD_KEY);
}

interface TimeSeriesResponse {
  status?: string;
  values?: { datetime: string; close: string }[];
}

/**
 * Daily close history. Free tier is capped at 8 requests/minute, so callers
 * must cache this aggressively (hours, not seconds) — see lib/mock/instruments.ts.
 */
export async function fetchTwelveDataHistory(symbol: string, days = 90): Promise<PricePoint[] | null> {
  if (!TD_KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${days}&apikey=${TD_KEY}`,
    );
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
