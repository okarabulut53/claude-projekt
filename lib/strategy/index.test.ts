import { describe, expect, it } from "vitest";
import { AnalysisResult, ScoreResult } from "@/lib/analysis";
import { applyAllStrategies, applyStrategy, getStrategy, STRATEGIES } from "./index";

function score(id: keyof AnalysisResult["scores"], value: number | null, factors: ScoreResult["factors"] = []): ScoreResult {
  return {
    id,
    label: id,
    score: value,
    availability: value === null ? "unavailable" : "available",
    unavailableReason: value === null ? "test: nicht verfügbar" : undefined,
    factors,
  };
}

/** momentum/risk are the two scores every existing (pre-Intraday) test in this file cares about;
 *  the other five default to unavailable unless a test explicitly overrides them via `extra`. */
function analysis(
  momentum: number | null,
  risk: number | null,
  extra: Partial<Record<Exclude<keyof AnalysisResult["scores"], "momentum" | "risk">, number | null>> = {},
): AnalysisResult {
  return {
    symbol: "TEST",
    generatedAt: new Date().toISOString(),
    scores: {
      momentum: score("momentum", momentum),
      risk: score("risk", risk),
      technical: score("technical", extra.technical ?? null),
      volume: score("volume", extra.volume ?? null),
      sentiment: score("sentiment", extra.sentiment ?? null),
      analystConsensus: score("analystConsensus", extra.analystConsensus ?? null),
      marketEnvironment: score("marketEnvironment", extra.marketEnvironment ?? null),
      valuation: score("valuation", extra.valuation ?? null),
    },
  };
}

describe("applyStrategy", () => {
  it("combines both scores per the config's weights (hand-checked)", () => {
    const momentumStrategy = getStrategy("momentum")!;
    const result = applyStrategy(analysis(80, 60), momentumStrategy);
    // 80*0.8 + 60*0.2 = 64 + 12 = 76
    expect(result.compositeScore).toBe(76);
    expect(result.availability).toBe("available");
    expect(result.missingScores).toHaveLength(0);
  });

  it("balanced strategy is a plain average of the two scores", () => {
    const balanced = getStrategy("balanced")!;
    const result = applyStrategy(analysis(80, 60), balanced);
    expect(result.compositeScore).toBe(70);
  });

  it("renormalizes weights when one score is unavailable, rather than treating it as 0", () => {
    const balanced = getStrategy("balanced")!;
    const result = applyStrategy(analysis(80, null), balanced);
    // Only momentum (80) is usable; renormalized weight is 100% of it, not diluted by a phantom 0.
    expect(result.compositeScore).toBe(80);
    expect(result.availability).toBe("partial");
    expect(result.missingScores).toHaveLength(1);
    expect(result.missingScores[0].id).toBe("risk");
    expect(result.usedScores).toHaveLength(1);
    expect(result.usedScores[0].normalizedWeight).toBe(1);
  });

  it("is unavailable when nothing is available", () => {
    const balanced = getStrategy("balanced")!;
    const result = applyStrategy(analysis(null, null), balanced);
    expect(result.compositeScore).toBeNull();
    expect(result.availability).toBe("unavailable");
  });

  it("never returns a non-null compositeScore alongside availability 'unavailable'", () => {
    for (const strategy of STRATEGIES) {
      for (const [m, r] of [
        [80, 60],
        [80, null],
        [null, 60],
        [null, null],
      ] as const) {
        const result = applyStrategy(analysis(m, r), strategy);
        if (result.availability === "unavailable") expect(result.compositeScore).toBeNull();
        else expect(result.compositeScore).not.toBeNull();
      }
    }
  });
});

describe("applyStrategy — intraday strategy", () => {
  it("renormalizes when analystConsensus/marketEnvironment are unavailable (e.g. crypto), instead of diluting with a phantom 0", () => {
    const intraday = getStrategy("intraday")!;
    // Crypto-like case: technical/volume/sentiment available (weights 0.35/0.15/0.25 = 0.75 of
    // the total), analystConsensus/marketEnvironment unavailable (0.15/0.10 = 0.25 dropped).
    const result = applyStrategy(analysis(null, null, { technical: 80, volume: 60, sentiment: 70 }), intraday);
    // Renormalized: (80*0.35 + 60*0.15 + 70*0.25) / (0.35+0.15+0.25) = (28+9+17.5)/0.75 = 72.67 -> 73
    expect(result.compositeScore).toBe(73);
    expect(result.availability).toBe("partial");
    expect(result.missingScores.map((m) => m.id).sort()).toEqual(["analystConsensus", "marketEnvironment"]);
    expect(result.usedScores).toHaveLength(3);
  });

  it("uses every factor at its configured weight when everything is available", () => {
    const intraday = getStrategy("intraday")!;
    const result = applyStrategy(
      analysis(null, null, { technical: 80, volume: 60, sentiment: 70, analystConsensus: 90, marketEnvironment: 50 }),
      intraday,
    );
    // 80*0.35 + 60*0.15 + 70*0.25 + 90*0.15 + 50*0.10 = 28+9+17.5+13.5+5 = 73
    expect(result.compositeScore).toBe(73);
    expect(result.availability).toBe("available");
    expect(result.missingScores).toHaveLength(0);
  });
});

describe("applyStrategy — long-term strategy", () => {
  it("weights valuation highest, then analystConsensus, technical/sentiment lowest", () => {
    const longTerm = getStrategy("long-term")!;
    const result = applyStrategy(
      analysis(null, null, { technical: 40, sentiment: 40, analystConsensus: 80, valuation: 90 }),
      longTerm,
    );
    // 90*0.5 + 80*0.3 + 40*0.1 + 40*0.1 = 45 + 24 + 4 + 4 = 77
    expect(result.compositeScore).toBe(77);
    expect(result.availability).toBe("available");
  });

  it("renormalizes away from valuation for a symbol outside the FMP coverage set, instead of treating it as 0", () => {
    const longTerm = getStrategy("long-term")!;
    // valuation unavailable (e.g. SAP/ASML/any non-NVDA/MSFT/TSLA symbol) — same renormalization
    // pattern as intraday's analystConsensus/marketEnvironment handling for crypto.
    const result = applyStrategy(analysis(null, null, { technical: 80, sentiment: 60, analystConsensus: 70 }), longTerm);
    // Renormalized over technical/sentiment/analystConsensus (0.1+0.1+0.3=0.5 of the total):
    // (80*0.1 + 60*0.1 + 70*0.3) / 0.5 = (8+6+21)/0.5 = 70
    expect(result.compositeScore).toBe(70);
    expect(result.availability).toBe("partial");
    expect(result.missingScores.map((m) => m.id)).toEqual(["valuation"]);
  });
});

describe("applyAllStrategies", () => {
  it("returns one result per defined strategy", () => {
    const results = applyAllStrategies(analysis(80, 60));
    expect(results).toHaveLength(STRATEGIES.length);
    expect(results.map((r) => r.strategyId).sort()).toEqual(STRATEGIES.map((s) => s.id).sort());
  });

  it("can produce genuinely different composite scores across strategies for the same instrument", () => {
    // Momentum-heavy vs. balanced weighting must actually disagree when momentum and risk diverge —
    // this is exactly the "widersprüchliches Signal" case the LLM layer is instructed to surface.
    const results = applyAllStrategies(analysis(95, 20));
    const momentumResult = results.find((r) => r.strategyId === "momentum")!;
    const balancedResult = results.find((r) => r.strategyId === "balanced")!;
    expect(momentumResult.compositeScore).not.toBe(balancedResult.compositeScore);
  });
});
