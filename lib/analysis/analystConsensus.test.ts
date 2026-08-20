import { describe, expect, it } from "vitest";
import { computeAnalystScore } from "./analystConsensus";

describe("computeAnalystScore", () => {
  it("is unavailable when counts is null (e.g. crypto/ETF with no analyst coverage)", () => {
    const result = computeAnalystScore(null);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toMatch(/Krypto\/ETF/);
  });

  it("is unavailable when all counts are 0", () => {
    const result = computeAnalystScore({ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 });
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
  });

  it("scores 100 when every analyst rates strong buy", () => {
    const result = computeAnalystScore({ strongBuy: 10, buy: 0, hold: 0, sell: 0, strongSell: 0 });
    expect(result.score).toBe(100);
  });

  it("scores 0 when every analyst rates strong sell", () => {
    const result = computeAnalystScore({ strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 10 });
    expect(result.score).toBe(0);
  });

  it("scores 50 when every analyst rates hold", () => {
    const result = computeAnalystScore({ strongBuy: 0, buy: 0, hold: 10, sell: 0, strongSell: 0 });
    expect(result.score).toBe(50);
  });

  it("computes a count-weighted average across mixed ratings (hand-checked)", () => {
    // strongBuy=100*5 + buy=75*3 + hold=50*2 = 500+225+100 = 825, /10 = 82.5 -> rounds to 83
    const result = computeAnalystScore({ strongBuy: 5, buy: 3, hold: 2, sell: 0, strongSell: 0 });
    expect(result.score).toBe(83);
  });

  it("includes every rating bucket in factors, even when 0", () => {
    const result = computeAnalystScore({ strongBuy: 5, buy: 0, hold: 0, sell: 0, strongSell: 0 });
    expect(result.factors).toHaveLength(5);
  });
});
