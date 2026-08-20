import { PricePoint } from "@/lib/types";
import { AnalysisResult } from "./types";
import { computeMomentumScore } from "./momentum";
import { computeRiskScore } from "./risk";
import { computeTechnicalScore } from "./technical";
import { computeVolumeScore } from "./volume";
import { computeSentimentScore, SentimentNewsInput } from "./sentiment";
import { computeAnalystScore, AnalystConsensusCounts } from "./analystConsensus";
import { computeMarketEnvironmentScore } from "./marketEnvironment";
import { computeValuationScore, ValuationInput } from "./valuation";

export * from "./types";
export { computeMomentumScore } from "./momentum";
export { computeRiskScore } from "./risk";
export { computeTechnicalScore } from "./technical";
export { computeVolumeScore } from "./volume";
export { computeSentimentScore } from "./sentiment";
export { computeAnalystScore } from "./analystConsensus";
export { computeMarketEnvironmentScore } from "./marketEnvironment";
export { computeValuationScore } from "./valuation";
export type { ValuationInput } from "./valuation";

/**
 * Entry point for the Analysis Layer — pure and deterministic (same inputs in always produce the
 * same scores out), no network calls of its own. Callers (chat tools in lib/finara-ai/tools.ts)
 * fetch the underlying data themselves (Instrument.history, news, analyst counts, fundamentals)
 * and pass it in.
 *
 * Momentum/Risk (Etappe 2), Technical/Volume/Sentiment/AnalystConsensus/MarketEnvironment
 * (Intraday-Score extension) and Valuation (the "long-term" strategy, fundamentals-derived —
 * see valuation.ts) together cover everything the Strategy Layer currently knows how to combine.
 * Quality/Growth/Macro/Portfolio-Fit remain unimplemented — they'd need data finara doesn't have
 * a source for yet — and are deliberately not stubbed out here with fake availability.
 */
export function computeAnalysis(
  symbol: string,
  history: PricePoint[],
  newsItems: SentimentNewsInput[],
  analystCounts: AnalystConsensusCounts | null,
  valuationInput: ValuationInput | null = null,
): AnalysisResult {
  return {
    symbol,
    generatedAt: new Date().toISOString(),
    scores: {
      momentum: computeMomentumScore(history),
      risk: computeRiskScore(history),
      technical: computeTechnicalScore(history),
      volume: computeVolumeScore(history),
      sentiment: computeSentimentScore(newsItems),
      analystConsensus: computeAnalystScore(analystCounts),
      marketEnvironment: computeMarketEnvironmentScore(),
      valuation: computeValuationScore(valuationInput),
    },
  };
}
