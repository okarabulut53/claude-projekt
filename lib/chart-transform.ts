import { CandleDatum } from "@/components/charts/CandlestickChart";
import { TwelveDataOhlcvBar } from "@/lib/market-data/twelvedata";
import { PricePoint } from "@/lib/types";
import { seededRandom } from "@/lib/mock/random";

/** Twelve Data returns newest-bar-first; lightweight-charts needs ascending order. */
export function twelveDataToCandles(bars: TwelveDataOhlcvBar[]): CandleDatum[] {
  return bars
    .map((b) => ({
      time: b.datetime,
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
      volume: Number(b.volume ?? 0),
    }))
    .reverse();
}

/**
 * Parses a CSV with a header row into candles. Column order doesn't matter as long as
 * the header names match (case-insensitive): date|time, open, high, low, close, volume.
 *
 *   date,open,high,low,close,volume
 *   2026-08-01,218.10,220.40,217.90,219.80,1345000
 *   2026-08-04,219.80,221.10,218.60,220.55,1198000
 */
export function csvToCandles(csv: string): CandleDatum[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const dateIdx = col("date") !== -1 ? col("date") : col("time");
  const openIdx = col("open");
  const highIdx = col("high");
  const lowIdx = col("low");
  const closeIdx = col("close");
  const volumeIdx = col("volume");

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",");
      return {
        time: cells[dateIdx]?.trim() ?? "",
        open: Number(cells[openIdx]),
        high: Number(cells[highIdx]),
        low: Number(cells[lowIdx]),
        close: Number(cells[closeIdx]),
        volume: volumeIdx !== -1 ? Number(cells[volumeIdx]) : 0,
      };
    })
    .filter((c) => c.time && Number.isFinite(c.close));
}

/**
 * finara's own instrument data (lib/types.ts's PricePoint) only tracks a single close
 * price per day, not full OHLCV — that's all Twelve Data's free tier close-history call
 * and the mock generator (lib/mock/random.ts) produce. This derives a plausible-looking
 * OHLC/volume bar per point purely so the candlestick chart has something to render for
 * those instruments. It is NOT real intraday range/volume data — prefer
 * twelveDataToCandles() whenever real OHLCV is available (see
 * fetchTwelveDataOhlcv in lib/market-data/twelvedata.ts).
 */
export function syntheticCandlesFromPricePoints(seedSymbol: string, history: PricePoint[]): CandleDatum[] {
  const random = seededRandom(`${seedSymbol}-ohlc`);
  return history.map((point, i) => {
    const open = history[i - 1]?.price ?? point.price;
    const close = point.price;
    const spread = Math.abs(close - open) * 0.6 + open * 0.002;
    return {
      // point.date is always a full ISO string (see PricePoint's producers), but this generates
      // one bar per calendar day with no real time-of-day — truncate to a pure date so
      // CandlestickChart's toChartTime() treats it as a business day, not a fake midnight timestamp
      // (which would otherwise show a spurious time in the legend/axis, timezone-shifted off UTC).
      time: point.date.slice(0, 10),
      open,
      high: Math.max(open, close) + spread * random(),
      low: Math.max(Math.min(open, close) - spread * random(), 0.01),
      close,
      volume: Math.round((500_000 + random() * 1_500_000) * (1 + Math.abs(close - open) / Math.max(open, 0.01))),
    };
  });
}
