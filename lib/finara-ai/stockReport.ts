import { Instrument } from "@/lib/types";
import { liveSymbols } from "@/lib/market-data/symbols";
import { fetchTwelveDataOhlcv } from "@/lib/market-data/twelvedata";
import { generateHistory } from "@/lib/mock/random";
import { cached } from "@/lib/market-data/cache";
import { computeSignalForInterval } from "./intradayTechnicals";
import { getMarginHistory, getRatios, getEarningsSurprises, FmpMarginHistoryRow, FmpEarningsSurprise } from "@/lib/data-providers/fmp";

// Duplicated from lib/mock/instruments.ts's private volatilityFactor const (not exported) — a
// 3-entry lookup table small/stable enough that re-declaring it here beats exporting an internal
// of that module just for this one caller.
const VOLATILITY_FACTOR: Record<Instrument["volatility"], number> = { niedrig: 0.012, mittel: 0.022, hoch: 0.045 };

interface PricePointLite {
  date: string;
  price: number;
}

/**
 * A dedicated, longer (up to ~1 year) daily price series for the Standard-Analysebericht's
 * performance table — deliberately separate from Instrument.history (capped at 90 days for every
 * other feature, see lib/mock/instruments.ts), since a 1W/1M/3M/YTD/1J table needs a full year to
 * be honestly computable. For simulated instruments, the deterministic generator is re-run for
 * more days using the SAME seed/volatility as the shared 90-day series, then rescaled so its most
 * recent point exactly matches instrument.price — otherwise this report's numbers would visibly
 * disagree with what get_instrument/get_analysis show for the same symbol (the underlying RNG
 * stream lands on a different value when asked for a different day count from the same seed).
 */
async function getLongHistory(symbol: string, instrument: Instrument): Promise<{ points: PricePointLite[]; dataSource: "live" | "simulated" }> {
  const map = liveSymbols[symbol.toUpperCase()];
  if (map) {
    const result = await cached(`stock-report-long-history:${map.twelveData}`, 6 * 3600_000, () =>
      fetchTwelveDataOhlcv(map.twelveData, "1day", 260),
    );
    if (result.ok && result.bars.length > 5) {
      const points = result.bars.map((b) => ({ date: new Date(b.datetime).toISOString(), price: Number(b.close) })).reverse();
      return { points, dataSource: "live" };
    }
  }

  const raw = generateHistory(symbol, 260, instrument.price * 0.9, VOLATILITY_FACTOR[instrument.volatility]);
  const lastRaw = raw[raw.length - 1]?.price ?? instrument.price;
  const scale = lastRaw > 0 ? instrument.price / lastRaw : 1;
  const points = raw.map((p) => ({ date: p.date, price: Math.round(p.price * scale * 100) / 100 }));
  return { points, dataSource: "simulated" };
}

function changeSinceIndexFromEnd(points: PricePointLite[], daysBack: number): number | null {
  const targetIndex = points.length - 1 - daysBack;
  if (targetIndex < 0 || points.length === 0) return null;
  const latest = points[points.length - 1].price;
  const reference = points[targetIndex].price;
  if (!reference) return null;
  return ((latest - reference) / reference) * 100;
}

function changeSinceDate(points: PricePointLite[], fromDate: Date): number | null {
  if (points.length === 0) return null;
  const idx = points.findIndex((p) => new Date(p.date) >= fromDate);
  if (idx === -1) return null;
  const latest = points[points.length - 1].price;
  const reference = points[idx].price;
  if (!reference) return null;
  return ((latest - reference) / reference) * 100;
}

export interface PerformanceWindow {
  window: "1W" | "1M" | "3M" | "YTD" | "1J";
  changePercent: number | null;
  unavailableReason?: string;
}

export interface PerformanceTableResult {
  symbol: string;
  dataSource: "live" | "simulated";
  windows: PerformanceWindow[];
}

export async function getPerformanceTable(symbol: string, instrument: Instrument): Promise<PerformanceTableResult> {
  const { points, dataSource } = await getLongHistory(symbol, instrument);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const raw: { window: PerformanceWindow["window"]; changePercent: number | null }[] = [
    { window: "1W", changePercent: changeSinceIndexFromEnd(points, 7) },
    { window: "1M", changePercent: changeSinceIndexFromEnd(points, 30) },
    { window: "3M", changePercent: changeSinceIndexFromEnd(points, 90) },
    { window: "YTD", changePercent: changeSinceDate(points, yearStart) },
    { window: "1J", changePercent: changeSinceIndexFromEnd(points, 365) },
  ];

  return {
    symbol: symbol.toUpperCase(),
    dataSource,
    windows: raw.map((w) =>
      w.changePercent === null
        ? { ...w, unavailableReason: "Nicht genug Kurshistorie für diesen Zeitraum verfügbar." }
        : w,
    ),
  };
}

export type HorizonSignalValue = "bullisch" | "neutral" | "bärisch" | "nicht verfügbar";

export interface HorizonSignal {
  label: string;
  signal: HorizonSignalValue;
  note: string;
}

export interface MultiHorizonResult {
  horizons: HorizonSignal[];
  /** Set only when horizons genuinely disagree (one bullish, one bearish) — the product spec
   *  requires such contradictions to be named explicitly, not smoothed over. */
  divergenceNote: string | null;
}

/**
 * Three technical-signal horizons for the Standard-Analysebericht ("Kurzfrist 1h-5h, Tageschart,
 * Wochenchart"): the 1h and weekly reads reuse intradayTechnicals.ts's computeSignalForInterval
 * (same RSI/MACD-derived heuristic used by the Kurzfrist-Vergleichsanalyse feature, just a
 * different interval) rather than a second parallel implementation; the daily read reuses the
 * already-computed technical ScoreResult (RSI/MACD/SMA/Bollinger/Stochastic/ADX blend) passed in
 * by the caller, translated onto the same bullisch/neutral/bärisch scale via simple thresholds.
 */
export async function getMultiHorizonSignal(symbol: string, dailyTechnicalScore: number | null): Promise<MultiHorizonResult> {
  const map = liveSymbols[symbol.toUpperCase()];

  const dailySignal: HorizonSignalValue =
    dailyTechnicalScore === null ? "nicht verfügbar" : dailyTechnicalScore >= 60 ? "bullisch" : dailyTechnicalScore <= 40 ? "bärisch" : "neutral";

  let hourlySignal: HorizonSignalValue = "nicht verfügbar";
  let weeklySignal: HorizonSignalValue = "nicht verfügbar";

  if (map) {
    const [hourlyRaw, weeklyRaw] = await Promise.all([
      computeSignalForInterval(map.twelveData, "1h", `stock-report-1h:${map.twelveData}`, 600_000, "den 1-Stunden-Zeitrahmen"),
      computeSignalForInterval(map.twelveData, "1week", `stock-report-1w:${map.twelveData}`, 6 * 3600_000, "den Wochenchart"),
    ]);
    hourlySignal = hourlyRaw.signal;
    weeklySignal = weeklyRaw.signal;
  }

  const horizons: HorizonSignal[] = [
    {
      label: "Kurzfristig (1h)",
      signal: hourlySignal,
      note: map ? "Aus Intraday-Indikatoren auf 1-Stunden-Basis." : "Keine Live-Intraday-Anbindung für dieses Symbol.",
    },
    {
      label: "Tageschart",
      signal: dailySignal,
      note: "Aus dem täglichen Technisch-Score (RSI/MACD/SMA/Bollinger/Stochastic/ADX-Blend).",
    },
    {
      label: "Wochenchart",
      signal: weeklySignal,
      note: map ? "Aus wöchentlichen Kursdaten." : "Keine Live-Wochendaten für dieses Symbol.",
    },
  ];

  const distinctSignals = new Set(horizons.map((h) => h.signal).filter((s) => s !== "nicht verfügbar"));
  const divergenceNote =
    distinctSignals.has("bullisch") && distinctSignals.has("bärisch")
      ? "Die Zeitebenen zeigen ein widersprüchliches Bild zwischen kurz- und längerfristigem Signal."
      : null;

  return { horizons, divergenceNote };
}

export interface ExtendedFundamentals {
  margins: FmpMarginHistoryRow[] | null;
  currentRatio: number | null;
  returnOnEquityPct: number | null;
  freeCashFlowYieldPct: number | null;
  debtToEquity: number | null;
  lastEarnings: FmpEarningsSurprise | null;
}

/**
 * Margin/revenue trend, balance-sheet-lite (Current Ratio/ROE from the already-verified
 * ratios-ttm endpoint), FCF yield (derived from get_fundamentals' existing FCF-per-share ÷
 * current price — no new endpoint needed for that one), and last earnings surprise. Callers must
 * catch FmpDailyLimitReachedError themselves (same as get_fundamentals) — the underlying fmpGet()
 * throws rather than returning null on quota exhaustion, deliberately, so a quota problem isn't
 * memoized as a 6h-long "not available" result.
 */
export async function getExtendedFundamentals(symbol: string, currentPrice: number): Promise<ExtendedFundamentals> {
  const [margins, ratios, lastEarnings] = await Promise.all([
    getMarginHistory(symbol),
    getRatios(symbol),
    getEarningsSurprises(symbol),
  ]);

  const freeCashFlowYieldPct =
    ratios?.freeCashFlowPerShareTTM !== undefined && ratios?.freeCashFlowPerShareTTM !== null && currentPrice > 0
      ? (ratios.freeCashFlowPerShareTTM / currentPrice) * 100
      : null;

  return {
    margins,
    currentRatio: ratios?.currentRatioTTM ?? null,
    returnOnEquityPct: ratios?.returnOnEquityTTM !== undefined && ratios?.returnOnEquityTTM !== null ? ratios.returnOnEquityTTM * 100 : null,
    freeCashFlowYieldPct,
    debtToEquity: ratios?.debtToEquityTTM ?? null,
    lastEarnings,
  };
}
