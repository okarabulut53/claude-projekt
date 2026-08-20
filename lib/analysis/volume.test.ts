import { describe, expect, it } from "vitest";
import { PricePoint } from "@/lib/types";
import { computeVolumeScore } from "./volume";

function makeHistory(points: { price: number; volume?: number }[]): PricePoint[] {
  return points.map((p, i) => ({ date: new Date(2026, 0, i + 1).toISOString(), price: p.price, volume: p.volume }));
}

describe("computeVolumeScore", () => {
  it("is unavailable when no point has volume data", () => {
    const result = computeVolumeScore(makeHistory(Array.from({ length: 40 }, () => ({ price: 100 }))));
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toMatch(/Keine Volumendaten/);
  });

  it("is unavailable when fewer than 10 points have volume data", () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ price: 100, volume: i < 5 ? 1000 : undefined }));
    const result = computeVolumeScore(makeHistory(points));
    expect(result.availability).toBe("unavailable");
  });

  it("scores neutral (50) when today's volume equals the 30-day average", () => {
    const points = Array.from({ length: 40 }, () => ({ price: 100, volume: 1_000_000 }));
    const result = computeVolumeScore(makeHistory(points));
    expect(result.availability).toBe("available");
    expect(result.score).toBe(50);
  });

  it("scores above neutral when today's volume is well above the 30-day average", () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ price: 100, volume: i === 39 ? 3_000_000 : 1_000_000 }));
    const result = computeVolumeScore(makeHistory(points));
    expect(result.score!).toBeGreaterThan(50);
  });

  it("scores below neutral when today's volume is well below the 30-day average", () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ price: 100, volume: i === 39 ? 300_000 : 1_000_000 }));
    const result = computeVolumeScore(makeHistory(points));
    expect(result.score!).toBeLessThan(50);
  });

  it("never returns a non-null score for an unavailable result", () => {
    for (let len = 0; len <= 40; len++) {
      const points = Array.from({ length: len }, () => ({ price: 100, volume: 1_000_000 }));
      const result = computeVolumeScore(makeHistory(points));
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
