import { describe, expect, it } from "vitest";
import { PricePoint } from "@/lib/types";
import { computeRiskScore } from "./risk";

function makeHistory(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ date: new Date(2026, 0, i + 1).toISOString(), price }));
}

describe("computeRiskScore", () => {
  it("is unavailable when there isn't enough history for either factor", () => {
    // 1 point: volatility needs >=10 points, drawdown needs >=2 — neither qualifies.
    const result = computeRiskScore(makeHistory([100]));
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.factors).toHaveLength(0);
  });

  it("computes only the drawdown factor when there's enough history for that but not volatility", () => {
    // 3 points: below volatility's 10-point minimum, but drawdown only needs >=2.
    const result = computeRiskScore(makeHistory([100, 101, 99]));
    expect(result.availability).toBe("available");
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].label).toBe("Maximaler Drawdown (Zeitraum)");
  });

  it("scores a perfectly flat price series near-maximum (zero volatility, zero drawdown)", () => {
    const result = computeRiskScore(makeHistory(Array.from({ length: 30 }, () => 100)));
    expect(result.availability).toBe("available");
    expect(result.score).toBe(100);
  });

  it("scores a sharp decline (large drawdown) clearly lower than the flat case", () => {
    const flat = computeRiskScore(makeHistory(Array.from({ length: 30 }, () => 100)));
    const decline = computeRiskScore(makeHistory(Array.from({ length: 30 }, (_, i) => 100 - i * 2))); // 100 -> 42
    expect(decline.score!).toBeLessThan(flat.score!);
  });

  it("scores a volatile random-walk-like series lower than the flat case", () => {
    const flat = computeRiskScore(makeHistory(Array.from({ length: 30 }, () => 100)));
    const choppy = computeRiskScore(
      makeHistory(Array.from({ length: 30 }, (_, i) => 100 + (i % 2 === 0 ? 15 : -15))),
    );
    expect(choppy.score!).toBeLessThan(flat.score!);
  });

  it("never returns a non-null score for an unavailable result", () => {
    for (let len = 0; len <= 30; len++) {
      const result = computeRiskScore(makeHistory(Array.from({ length: len }, () => 100)));
      if (result.availability === "unavailable") {
        expect(result.score).toBeNull();
      } else {
        expect(result.score).not.toBeNull();
        expect(result.score!).toBeGreaterThanOrEqual(0);
        expect(result.score!).toBeLessThanOrEqual(100);
      }
    }
  });
});
