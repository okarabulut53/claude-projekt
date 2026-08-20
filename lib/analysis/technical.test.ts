import { describe, expect, it } from "vitest";
import { PricePoint } from "@/lib/types";
import { computeTechnicalScore } from "./technical";

function makeHistory(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ date: new Date(2026, 0, i + 1).toISOString(), price }));
}

describe("computeTechnicalScore", () => {
  it("is unavailable for an empty history", () => {
    const result = computeTechnicalScore([]);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.factors).toHaveLength(0);
  });

  it("is unavailable when there isn't enough history for any indicator", () => {
    const result = computeTechnicalScore(makeHistory([100, 101, 99, 102, 100]));
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toBeTruthy();
  });

  it("scores a long, clean uptrend clearly above neutral (50)", () => {
    const prices = Array.from({ length: 250 }, (_, i) => 100 + i * 0.5);
    const result = computeTechnicalScore(makeHistory(prices));
    expect(result.availability).toBe("available");
    expect(result.score!).toBeGreaterThan(50);
    // All six indicators should have fired with 250 points of monotonic history.
    expect(result.factors).toHaveLength(6);
  });

  it("scores a long, clean downtrend clearly below neutral (50)", () => {
    const prices = Array.from({ length: 250 }, (_, i) => 300 - i * 0.5);
    const result = computeTechnicalScore(makeHistory(prices));
    expect(result.availability).toBe("available");
    expect(result.score!).toBeLessThan(50);
  });

  it("lists every indicator as a factor even when some are unavailable (marked, not omitted)", () => {
    // 20 points: enough for RSI/MACD... actually MACD needs ~35, so this exercises the
    // "some indicators unavailable" path while RSI (needs >14) already fires.
    const result = computeTechnicalScore(makeHistory(Array.from({ length: 20 }, (_, i) => 100 + i)));
    expect(result.factors).toHaveLength(6);
    const macdFactor = result.factors.find((f) => f.label === "MACD");
    expect(macdFactor?.value).toMatch(/nicht verfügbar/);
  });

  it("never returns a non-null score for an unavailable result", () => {
    for (let len = 0; len <= 40; len++) {
      const result = computeTechnicalScore(makeHistory(Array.from({ length: len }, () => 100)));
      if (result.availability === "unavailable") {
        expect(result.score).toBeNull();
        expect(result.factors).toHaveLength(0);
      } else {
        expect(result.score).not.toBeNull();
        expect(result.score!).toBeGreaterThanOrEqual(0);
        expect(result.score!).toBeLessThanOrEqual(100);
      }
    }
  });
});
