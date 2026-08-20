import { fetchTwelveDataOhlcv } from "@/lib/market-data/twelvedata";
import { liveSymbols } from "@/lib/market-data/symbols";
import { twelveDataToCandles } from "@/lib/chart-transform";
import { cached } from "@/lib/market-data/cache";
import { rsi, macd, adx, stochastic } from "@/lib/indicators";

export type IntradayTimeframe = "1m" | "5m" | "15m";

const TWELVE_DATA_INTERVAL: Record<IntradayTimeframe, string> = { "1m": "1min", "5m": "5min", "15m": "15min" };
// Free-tier-friendly TTLs — shorter timeframes move faster but also burn through the shared
// 8-req/min Twelve Data queue fastest, so 1m gets the shortest cache, not zero caching.
const CACHE_TTL_MS: Record<IntradayTimeframe, number> = { "1m": 30_000, "5m": 120_000, "15m": 300_000 };
// Wilder's ADX needs > period*2 bars before it produces a value at all (see lib/indicators.ts) —
// request comfortably more than that so ADX isn't spuriously "nicht verfügbar" on a technicality.
const OUTPUT_SIZE = 100;

export interface IntradayTimeframeResult {
  timeframe: IntradayTimeframe;
  available: boolean;
  unavailableReason?: string;
  rsi: number | null;
  macdHistogram: number | null;
  adx: number | null;
  stochasticK: number | null;
  /** Simple heuristic (RSI vs. 50 + MACD-histogram sign), NOT the app's core weighted technical
   *  score from lib/analysis/technical.ts — a lighter read meant only to eyeball one timeframe at
   *  a glance in the comparison table. */
  signal: "bullisch" | "neutral" | "bärisch" | "nicht verfügbar";
}

export interface IntradayTechnicalsResult {
  symbol: string;
  dataSource: "live" | "unavailable";
  timeframes: IntradayTimeframeResult[];
}

function unavailableTimeframe(timeframe: IntradayTimeframe, reason: string): IntradayTimeframeResult {
  return {
    timeframe,
    available: false,
    unavailableReason: reason,
    rsi: null,
    macdHistogram: null,
    adx: null,
    stochasticK: null,
    signal: "nicht verfügbar",
  };
}

function deriveSignal(rsiValue: number | null, macdHistogram: number | null): IntradayTimeframeResult["signal"] {
  if (rsiValue === null || macdHistogram === null) return "nicht verfügbar";
  if (rsiValue > 50 && macdHistogram > 0) return "bullisch";
  if (rsiValue < 50 && macdHistogram < 0) return "bärisch";
  return "neutral";
}

interface RawSignalResult {
  available: boolean;
  unavailableReason?: string;
  rsi: number | null;
  macdHistogram: number | null;
  adx: number | null;
  stochasticK: number | null;
  signal: IntradayTimeframeResult["signal"];
}

/**
 * Generic OHLCV-fetch-and-derive-a-signal core, factored out of computeTimeframe below so
 * lib/finara-ai/stockReport.ts's multi-horizon technical read (1h + weekly, for the Standard-
 * Analysebericht feature) can reuse the exact same RSI/MACD/ADX/Stochastic + signal-derivation
 * logic instead of a second, parallel implementation — only the Twelve Data interval string,
 * cache key, and cache TTL differ per caller.
 */
async function computeSignalForInterval(
  twelveDataSymbol: string,
  twelveDataInterval: string,
  cacheKey: string,
  cacheTtlMs: number,
  unavailableLabel: string,
): Promise<RawSignalResult> {
  const result = await cached(cacheKey, cacheTtlMs, () => fetchTwelveDataOhlcv(twelveDataSymbol, twelveDataInterval, OUTPUT_SIZE));

  const unavailable = (reason: string): RawSignalResult => ({
    available: false,
    unavailableReason: reason,
    rsi: null,
    macdHistogram: null,
    adx: null,
    stochasticK: null,
    signal: "nicht verfügbar",
  });

  if (!result.ok) {
    const reason =
      result.reason === "rate_limit"
        ? "Twelve-Data-Rate-Limit erreicht, Daten für diesen Zeitrahmen gerade nicht abrufbar."
        : result.reason === "unconfigured"
          ? "Intraday-Datenanbindung ist bei finara aktuell nicht konfiguriert."
          : `Für ${unavailableLabel} liegen aktuell keine Kursdaten vor.`;
    return unavailable(reason);
  }

  const candles = twelveDataToCandles(result.bars);
  // Free-tier Twelve Data plans commonly cap history at a handful of bars — if what came back is
  // too short for even the shortest indicator (RSI, 14+1), the whole timeframe is "nicht
  // verfügbar" per the product spec, not a half-computed result.
  if (candles.length < 16) {
    return unavailable(`Zu wenige Kursdaten für ${unavailableLabel} verfügbar.`);
  }

  const rsiPoints = rsi(candles, 14);
  const macdResult = macd(candles);
  const adxResult = adx(candles, 14);
  const stochResult = stochastic(candles, 14, 3);

  const lastRsi = rsiPoints.at(-1)?.value ?? null;
  const lastMacdHistogram = macdResult.histogram.at(-1)?.value ?? null;
  const lastAdx = adxResult.adx.at(-1)?.value ?? null;
  const lastStochK = stochResult.k.at(-1)?.value ?? null;

  return {
    available: true,
    rsi: lastRsi === null ? null : Math.round(lastRsi * 10) / 10,
    macdHistogram: lastMacdHistogram === null ? null : Math.round(lastMacdHistogram * 100) / 100,
    adx: lastAdx === null ? null : Math.round(lastAdx * 10) / 10,
    stochasticK: lastStochK === null ? null : Math.round(lastStochK * 10) / 10,
    signal: deriveSignal(lastRsi, lastMacdHistogram),
  };
}

async function computeTimeframe(twelveDataSymbol: string, timeframe: IntradayTimeframe): Promise<IntradayTimeframeResult> {
  const raw = await computeSignalForInterval(
    twelveDataSymbol,
    TWELVE_DATA_INTERVAL[timeframe],
    `intraday-technicals:${twelveDataSymbol}:${timeframe}`,
    CACHE_TTL_MS[timeframe],
    `den Zeitrahmen ${timeframe}`,
  );
  return { timeframe, ...raw };
}

/** Exported for lib/finara-ai/stockReport.ts — same core computation as computeTimeframe above,
 *  for an arbitrary Twelve Data interval/cache key (used there for "1h" and "1week"). */
export { computeSignalForInterval };

/**
 * Multi-timeframe intraday technicals (default 1min/5min/15min) for finara's short-term
 * comparison feature. Only available for symbols with a real Twelve Data mapping
 * (lib/market-data/symbols.ts's liveSymbols, currently 8 US-listed/crypto symbols) — the mock/
 * simulated instrument generator has no intraday OHLC series to compute real indicators from, so
 * every timeframe comes back explicitly "nicht verfügbar" rather than a value derived from
 * simulated daily data pretending to be intraday.
 */
export async function getIntradayTechnicals(
  symbol: string,
  timeframes: IntradayTimeframe[] = ["1m", "5m", "15m"],
): Promise<IntradayTechnicalsResult> {
  const map = liveSymbols[symbol.toUpperCase()];
  if (!map) {
    return {
      symbol,
      dataSource: "unavailable",
      timeframes: timeframes.map((tf) => unavailableTimeframe(tf, `${symbol} hat keine Live-Intraday-Datenanbindung bei finara.`)),
    };
  }

  const results = await Promise.all(timeframes.map((tf) => computeTimeframe(map.twelveData, tf)));
  return { symbol: symbol.toUpperCase(), dataSource: "live", timeframes: results };
}
