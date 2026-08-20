import { describe, expect, it } from "vitest";
import { PricePoint } from "@/lib/types";
import { computeMomentumScore } from "./momentum";

function makeHistory(prices: number[]): PricePoint[] {
  return prices.map((price, i) => ({ date: new Date(2026, 0, i + 1).toISOString(), price }));
}

describe("computeMomentumScore", () => {
  it("is unavailable when there isn't enough history for any factor", () => {
    const result = computeMomentumScore(makeHistory([100, 101, 99, 102, 100]));
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.factors).toHaveLength(0);
    expect(result.unavailableReason).toBeTruthy();
  });

  it("is unavailable for an empty history", () => {
    const result = computeMomentumScore([]);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
  });

  it("scores a clean uptrend clearly above neutral (50)", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i); // steady, monotonic rise
    const result = computeMomentumScore(makeHistory(prices));
    expect(result.availability).toBe("available");
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(50);
    // Every factor that fires must be reflected in `factors` — never a phantom contributor.
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it("scores a clean downtrend clearly below neutral (50)", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 140 - i); // steady, monotonic fall
    const result = computeMomentumScore(makeHistory(prices));
    expect(result.availability).toBe("available");
    expect(result.score!).toBeLessThan(50);
  });

  it("never returns a non-null score for an unavailable result (no silent hallucinated number)", () => {
    for (let len = 0; len <= 40; len++) {
      const result = computeMomentumScore(makeHistory(Array.from({ length: len }, () => 100)));
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
