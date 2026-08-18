import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/current-user";
import { cached } from "@/lib/market-data/cache";
import { fetchFinnhubQuote } from "@/lib/market-data/finnhub";
import {
  fetchTwelveDataOhlcvOrThrow,
  TwelveDataRateLimitError,
  TwelveDataUnavailableError,
} from "@/lib/market-data/twelvedata";
import { liveSymbols } from "@/lib/market-data/symbols";
import { twelveDataToCandles } from "@/lib/chart-transform";
import type { ChartInterval } from "@/components/charts/CandlestickChart";

/** Twelve Data interval strings — https://twelvedata.com/docs#time-series */
const TD_INTERVAL: Record<ChartInterval, string> = {
  "5m": "5min",
  "1h": "1h",
  "1D": "1day",
  "1M": "1month",
};

/** Cache TTL per interval — free tier is 8 req/min, 800/day, so intraday needs shorter TTLs than daily/monthly. */
const CACHE_TTL_MS: Record<ChartInterval, number> = {
  "5m": 60_000,
  "1h": 5 * 60_000,
  "1D": 6 * 3600_000,
  "1M": 6 * 3600_000,
};

function isChartInterval(value: string): value is ChartInterval {
  return value === "5m" || value === "1h" || value === "1D" || value === "1M";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ symbol: string }> }) {
  await requireUserId();

  const { symbol: rawSymbol } = await params;
  const symbol = rawSymbol.toUpperCase();
  const intervalParam = request.nextUrl.searchParams.get("interval") ?? "1D";
  const interval = isChartInterval(intervalParam) ? intervalParam : "1D";

  // Range buttons (see CandlestickChart's selectRange) request more bars than the default when
  // the currently-loaded data doesn't cover what they need (e.g. 1300 for "5Y") — clamped to
  // Twelve Data's documented outputsize range (1-5000).
  const outputsizeRaw = request.nextUrl.searchParams.get("outputsize");
  const outputsizeParam = outputsizeRaw ? Number(outputsizeRaw) : NaN;
  const outputsize = Number.isFinite(outputsizeParam) ? Math.min(5000, Math.max(1, Math.trunc(outputsizeParam))) : 200;

  const map = liveSymbols[symbol];
  if (!map) {
    return NextResponse.json(
      { candles: null, quote: null, error: "not_live", message: `${symbol} ist nicht mit Live-Daten verknüpft.` },
      { status: 404 },
    );
  }

  const quote = await cached(`quote:${symbol}`, 60_000, () => fetchFinnhubQuote(map.finnhub));

  try {
    const bars = await cached(`chart:${symbol}:${interval}:${outputsize}`, CACHE_TTL_MS[interval], () =>
      fetchTwelveDataOhlcvOrThrow(map.twelveData, TD_INTERVAL[interval], outputsize),
    );
    return NextResponse.json({ candles: twelveDataToCandles(bars), quote, source: "live" });
  } catch (err) {
    if (err instanceof TwelveDataRateLimitError) {
      return NextResponse.json(
        {
          candles: null,
          quote,
          error: "rate_limit",
          message: "Twelve-Data-Rate-Limit erreicht (Free Tier: 8 Anfragen/Min, 800/Tag). Bitte kurz warten.",
        },
        { status: 429 },
      );
    }
    const reason = err instanceof TwelveDataUnavailableError ? err.message : "error";
    return NextResponse.json(
      {
        candles: null,
        quote,
        error: reason,
        message:
          reason === "unconfigured"
            ? "TWELVE_DATA_API_KEY ist nicht konfiguriert."
            : `Für ${symbol} liegen für dieses Intervall aktuell keine Kursdaten vor.`,
      },
      { status: reason === "unconfigured" ? 501 : 502 },
    );
  }
}
