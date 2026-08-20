import { describe, expect, it } from "vitest";
import { computePivotLevels } from "./pivotPoints";

describe("computePivotLevels", () => {
  it("computes the classic Standard/Floor-Trader pivot formulas for known OHLC data", () => {
    // High=110, Low=90, Close=100 — round numbers chosen so every derived level is easy to
    // verify by hand: Pivot = (110+90+100)/3 = 100.
    const levels = computePivotLevels({ high: 110, low: 90, close: 100 });

    expect(levels.pivot).toBeCloseTo(100, 6);
    expect(levels.r1).toBeCloseTo(2 * 100 - 90, 6); // 110
    expect(levels.s1).toBeCloseTo(2 * 100 - 110, 6); // 90
    expect(levels.r2).toBeCloseTo(100 + (110 - 90), 6); // 120
    expect(levels.s2).toBeCloseTo(100 - (110 - 90), 6); // 80
    expect(levels.r3).toBeCloseTo(110 + 2 * (100 - 90), 6); // 130
    expect(levels.s3).toBeCloseTo(90 - 2 * (110 - 100), 6); // 70
  });

  it("keeps resistance levels above the pivot and support levels below it for a real, non-symmetric range", () => {
    const levels = computePivotLevels({ high: 254.3, low: 247.8, close: 251.6 });

    expect(levels.r3).toBeGreaterThan(levels.r2);
    expect(levels.r2).toBeGreaterThan(levels.r1);
    expect(levels.r1).toBeGreaterThan(levels.pivot);
    expect(levels.pivot).toBeGreaterThan(levels.s1);
    expect(levels.s1).toBeGreaterThan(levels.s2);
    expect(levels.s2).toBeGreaterThan(levels.s3);
  });
});
