import { fetchTwelveDataOhlcv } from "@/lib/market-data/twelvedata";
import { liveSymbols } from "@/lib/market-data/symbols";
import { getInstrument } from "@/lib/mock/instruments";
import { cached } from "@/lib/market-data/cache";

export interface PivotLevels {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

/** Classic (Standard/Floor Trader) pivot points — pure arithmetic from one period's High/Low/
 *  Close, no external data needed once the OHLC values are known. */
export function computePivotLevels(ohlc: { high: number; low: number; close: number }): PivotLevels {
  const { high, low, close } = ohlc;
  const pivot = (high + low + close) / 3;
  return {
    pivot,
    r1: 2 * pivot - low,
    s1: 2 * pivot - high,
    r2: pivot + (high - low),
    s2: pivot - (high - low),
    r3: high + 2 * (pivot - low),
    s3: low - 2 * (high - pivot),
  };
}

export type PivotTimeframe = "1D" | "1W";

export interface PivotPointsResult {
  symbol: string;
  timeframe: PivotTimeframe;
  dataSource: "live" | "simulated" | "unavailable";
  basis?: { high: number; low: number; close: number; periodEnd: string };
  levels: PivotLevels | null;
  message?: string;
}

const CACHE_TTL_MS: Record<PivotTimeframe, number> = { "1D": 3600_000, "1W": 6 * 3600_000 };

/**
 * Pivot points are computed from the PREVIOUS completed trading period's High/Low/Close (the
 * standard convention — "today's" pivots use yesterday's OHLC). For live symbols this pulls 2
 * bars from Twelve Data and uses the second-to-last one; if only 1 bar comes back (e.g. very
 * early in a new period), that single bar is used with a note that it may not be a fully closed
 * period yet — never silently treated as equivalent to a confirmed prior-period close.
 *
 * For symbols without a real Twelve Data mapping (the mock/simulated instrument set), High/Low
 * are approximated from the single simulated close price with a small fixed spread (±0.6%) —
 * consistent with the rest of the app's "simulated" data (the whole instrument is already
 * synthetic, so a synthetic High/Low around it isn't a new kind of fabrication), but always
 * labeled dataSource:"simulated" so the levels are never mistaken for real intraday range data.
 */
export async function getPivotPoints(symbol: string, timeframe: PivotTimeframe = "1D"): Promise<PivotPointsResult> {
  const upperSymbol = symbol.toUpperCase();
  const map = liveSymbols[upperSymbol];

  if (map) {
    const interval = timeframe === "1D" ? "1day" : "1week";
    const result = await cached(`pivot-points:${map.twelveData}:${timeframe}`, CACHE_TTL_MS[timeframe], () =>
      fetchTwelveDataOhlcv(map.twelveData, interval, 2),
    );
    if (!result.ok || result.bars.length === 0) {
      return {
        symbol: upperSymbol,
        timeframe,
        dataSource: "unavailable",
        levels: null,
        message: "Für Pivot-Points aktuell keine ausreichenden Kursdaten verfügbar.",
      };
    }
    // Twelve Data returns newest-bar-first; the previous (fully completed) period is bars[1] when
    // two bars are available, otherwise the only bar we have.
    const bar = result.bars.length >= 2 ? result.bars[1] : result.bars[0];
    const basis = { high: Number(bar.high), low: Number(bar.low), close: Number(bar.close), periodEnd: bar.datetime };
    return {
      symbol: upperSymbol,
      timeframe,
      dataSource: "live",
      basis,
      levels: computePivotLevels(basis),
      ...(result.bars.length < 2
        ? { message: "Nur eine Handelsperiode verfügbar — evtl. noch nicht vollständig abgeschlossen." }
        : {}),
    };
  }

  const instrument = await getInstrument(upperSymbol);
  if (!instrument) {
    return { symbol: upperSymbol, timeframe, dataSource: "unavailable", levels: null, message: `Kein Instrument mit Symbol ${upperSymbol} gefunden.` };
  }
  const basis = { high: instrument.price * 1.006, low: instrument.price * 0.994, close: instrument.price, periodEnd: "simuliert" };
  return {
    symbol: upperSymbol,
    timeframe,
    dataSource: "simulated",
    basis,
    levels: computePivotLevels(basis),
    message: "High/Low sind aus dem simulierten Schlusskurs angenähert, keine echten Intraday-Extremwerte.",
  };
}
