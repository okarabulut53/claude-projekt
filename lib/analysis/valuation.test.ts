import { describe, expect, it } from "vitest";
import { computeValuationScore, ValuationInput } from "./valuation";

describe("computeValuationScore", () => {
  it("is unavailable with no fundamentals input at all (e.g. symbol outside the FMP coverage set)", () => {
    const result = computeValuationScore(null);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
    expect(result.unavailableReason).toMatch(/NVDA, MSFT und TSLA/);
  });

  it("is unavailable when every individual metric is null", () => {
    const input: ValuationInput = { peRatio: null, pegRatio: null, dividendYield: null, debtToEquity: null };
    const result = computeValuationScore(input);
    expect(result.availability).toBe("unavailable");
    expect(result.score).toBeNull();
  });

  it("scores a cheap, low-debt, dividend-paying instrument clearly higher than an expensive, high-debt, non-paying one", () => {
    const cheap: ValuationInput = { peRatio: 10, pegRatio: 0.8, dividendYield: 0.03, debtToEquity: 0.3 };
    const expensive: ValuationInput = { peRatio: 60, pegRatio: 4, dividendYield: 0, debtToEquity: 3 };
    const cheapResult = computeValuationScore(cheap);
    const expensiveResult = computeValuationScore(expensive);
    expect(cheapResult.availability).toBe("available");
    expect(expensiveResult.availability).toBe("available");
    expect(cheapResult.score!).toBeGreaterThan(expensiveResult.score!);
  });

  it("excludes a non-positive KGV/PEG from the score instead of treating a loss-making company as 'cheap'", () => {
    // Only dividendYield/debtToEquity are scoreable; peRatio/pegRatio are shown as factors but not
    // averaged in (a P/E of -5 is not more attractive than a P/E of 15).
    const lossMaking: ValuationInput = { peRatio: -5, pegRatio: -2, dividendYield: 0.02, debtToEquity: 0.5 };
    const result = computeValuationScore(lossMaking);
    expect(result.availability).toBe("available");
    expect(result.factors.map((f) => f.label)).toEqual(
      expect.arrayContaining(["KGV", "PEG-Verhältnis", "Dividendenrendite", "Verschuldungsgrad (Debt/Equity)"]),
    );
    // Sanity check: a positive-KGV version of the same profile should NOT score identically to
    // this one being averaged in as if -5/-2 were valid inputs (would pull the score up further).
    const positiveKgv: ValuationInput = { peRatio: 12, pegRatio: 1, dividendYield: 0.02, debtToEquity: 0.5 };
    const positiveResult = computeValuationScore(positiveKgv);
    expect(positiveResult.score!).toBeGreaterThan(result.score!);
  });

  it("scores higher dividend yield more attractively for a long-term read", () => {
    const noDividend: ValuationInput = { peRatio: null, pegRatio: null, dividendYield: 0, debtToEquity: null };
    const highDividend: ValuationInput = { peRatio: null, pegRatio: null, dividendYield: 0.05, debtToEquity: null };
    expect(computeValuationScore(highDividend).score!).toBeGreaterThan(computeValuationScore(noDividend).score!);
  });

  it("never returns a non-null score for an unavailable result, and stays within 0-100 otherwise", () => {
    const cases: (ValuationInput | null)[] = [
      null,
      { peRatio: null, pegRatio: null, dividendYield: null, debtToEquity: null },
      { peRatio: 15, pegRatio: null, dividendYield: null, debtToEquity: null },
      { peRatio: -1, pegRatio: -1, dividendYield: null, debtToEquity: null },
      { peRatio: 200, pegRatio: 10, dividendYield: 0.1, debtToEquity: 10 },
    ];
    for (const input of cases) {
      const result = computeValuationScore(input);
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
