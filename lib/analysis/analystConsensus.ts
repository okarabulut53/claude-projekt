import { ScoreFactor, ScoreResult } from "./types";

export interface AnalystConsensusCounts {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

const RATING_SCORE: Record<keyof AnalystConsensusCounts, number> = {
  strongBuy: 100,
  buy: 75,
  hold: 50,
  sell: 25,
  strongSell: 0,
};

/**
 * Analyst Consensus Score (0-100, higher = more bullish consensus) — a count-weighted average of
 * real analyst ratings (strongBuy=100 … strongSell=0). `counts` comes from Finnhub's
 * recommendation-trends endpoint (see lib/market-data/finnhub.ts's
 * fetchFinnhubRecommendationTrends) — that endpoint only covers stocks, so this is always
 * unavailable for crypto/ETFs rather than a guessed neutral value.
 */
export function computeAnalystScore(counts: AnalystConsensusCounts | null): ScoreResult {
  if (!counts) {
    return {
      id: "analystConsensus",
      label: "Analysten-Konsens",
      score: null,
      availability: "unavailable",
      unavailableReason: "Kein Analysten-Konsens verfügbar (z. B. Krypto/ETF, oder Datenquelle liefert keine Bewertungen für dieses Symbol).",
      factors: [],
    };
  }

  const total = counts.strongBuy + counts.buy + counts.hold + counts.sell + counts.strongSell;
  if (total === 0) {
    return {
      id: "analystConsensus",
      label: "Analysten-Konsens",
      score: null,
      availability: "unavailable",
      unavailableReason: "Datenquelle liefert 0 Analysten-Bewertungen für dieses Symbol.",
      factors: [],
    };
  }

  const weightedSum = (Object.keys(RATING_SCORE) as (keyof AnalystConsensusCounts)[]).reduce(
    (sum, key) => sum + counts[key] * RATING_SCORE[key],
    0,
  );

  const factors: ScoreFactor[] = [
    { label: "Strong Buy", value: String(counts.strongBuy) },
    { label: "Buy", value: String(counts.buy) },
    { label: "Hold", value: String(counts.hold) },
    { label: "Sell", value: String(counts.sell) },
    { label: "Strong Sell", value: String(counts.strongSell) },
  ];

  return {
    id: "analystConsensus",
    label: "Analysten-Konsens",
    score: Math.round(weightedSum / total),
    availability: "available",
    factors,
  };
}
