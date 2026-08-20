import { describe, expect, it, vi } from "vitest";
import { getIntradayTechnicals } from "./intradayTechnicals";
import { fetchTwelveDataOhlcv } from "@/lib/market-data/twelvedata";

vi.mock("@/lib/market-data/twelvedata", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/market-data/twelvedata")>();
  return { ...actual, fetchTwelveDataOhlcv: vi.fn() };
});

const mockedFetch = vi.mocked(fetchTwelveDataOhlcv);

/**
 * Bars with an ACCELERATING uptrend (not a constant-slope ramp) — enough for RSI(14)/MACD/
 * ADX(14)/Stochastic to all produce a value. Acceleration matters: a perfectly linear ramp makes
 * the MACD line converge to a constant, which drags the histogram (macd - its own signal EMA)
 * back toward zero once the signal line catches up — a steadily *widening* gap between fast and
 * slow EMA is what keeps the histogram clearly positive through the whole series.
 */
function makeBullishBars(count: number) {
  const bars = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price += 1 + i * 0.15;
    bars.push({
      datetime: new Date(2026, 7, 20, 10, i).toISOString(),
      open: String(price - 0.5),
      high: String(price + 0.5),
      low: String(price - 1),
      close: String(price),
      volume: "1000",
    });
  }
  // Twelve Data returns newest-first.
  return bars.reverse();
}

describe("getIntradayTechnicals", () => {
  it("returns 'nicht verfügbar' for every timeframe when the symbol has no live intraday mapping", async () => {
    const result = await getIntradayTechnicals("SIE", ["1m", "5m"]);
    expect(result.dataSource).toBe("unavailable");
    expect(result.timeframes).toHaveLength(2);
    for (const tf of result.timeframes) {
      expect(tf.available).toBe(false);
      expect(tf.signal).toBe("nicht verfügbar");
      expect(tf.unavailableReason).toMatch(/keine Live-Intraday-Datenanbindung/);
    }
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("marks a whole timeframe unavailable (not just individual indicators) when Twelve Data has no data for it", async () => {
    mockedFetch.mockResolvedValueOnce({ ok: false, reason: "not_found" });

    const result = await getIntradayTechnicals("TSLA", ["1m"]);

    expect(result.dataSource).toBe("live");
    expect(result.timeframes).toHaveLength(1);
    expect(result.timeframes[0].available).toBe(false);
    expect(result.timeframes[0].rsi).toBeNull();
    expect(result.timeframes[0].macdHistogram).toBeNull();
    expect(result.timeframes[0].adx).toBeNull();
    expect(result.timeframes[0].signal).toBe("nicht verfügbar");
  });

  it("computes real RSI/MACD/ADX/Stochastic and a bullish signal from real OHLCV bars", async () => {
    // Fresh symbol (not TSLA/MSFT used by the other tests in this file) so the shared
    // lib/market-data/cache.ts cache starts cold here instead of serving a previous test's result.
    mockedFetch.mockResolvedValueOnce({ ok: true, bars: makeBullishBars(60) });

    const result = await getIntradayTechnicals("NVDA", ["5m"]);

    const tf = result.timeframes[0];
    expect(tf.available).toBe(true);
    expect(tf.rsi).not.toBeNull();
    expect(tf.rsi).toBeGreaterThan(50);
    expect(tf.macdHistogram).not.toBeNull();
    expect(tf.adx).not.toBeNull();
    expect(tf.signal).toBe("bullisch");
  });

  it("degrades one failed timeframe to 'nicht verfügbar' without failing the others", async () => {
    // Another fresh symbol, same cache-collision reasoning as above.
    mockedFetch.mockResolvedValueOnce({ ok: true, bars: makeBullishBars(60) }).mockResolvedValueOnce({ ok: false, reason: "rate_limit" });

    const result = await getIntradayTechnicals("MSFT", ["5m", "15m"]);

    const fiveMin = result.timeframes.find((t) => t.timeframe === "5m")!;
    const fifteenMin = result.timeframes.find((t) => t.timeframe === "15m")!;
    expect(fiveMin.available).toBe(true);
    expect(fifteenMin.available).toBe(false);
    expect(fifteenMin.unavailableReason).toMatch(/Rate-Limit/);
  });
});
