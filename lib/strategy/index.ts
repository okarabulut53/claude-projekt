import { AnalysisResult } from "@/lib/analysis";
import { STRATEGIES } from "./config";
import {
  AnalysisScores,
  IMPLEMENTED_SCORE_IDS,
  ScoreId,
  StrategyDefinition,
  StrategyMissingScore,
  StrategyResult,
  StrategyScoreUsage,
} from "./types";

export * from "./types";
export { STRATEGIES, getStrategy } from "./config";

function scoresById(analysis: AnalysisResult): AnalysisScores {
  return Object.fromEntries(IMPLEMENTED_SCORE_IDS.map((id) => [id, analysis.scores[id]])) as AnalysisScores;
}

/**
 * Combines an AnalysisResult's scores into one composite per a strategy's weights. Missing/
 * unavailable scores are dropped from both the numerator and the weight total (renormalized
 * among what's left) rather than counted as 0 — the same "never silently guess a missing factor"
 * rule the Analysis Layer itself follows (see lib/analysis/scale.ts's averageAvailable).
 */
export function applyStrategy(analysis: AnalysisResult, strategy: StrategyDefinition): StrategyResult {
  const byId = scoresById(analysis);
  const usedScores: StrategyScoreUsage[] = [];
  const missingScores: StrategyMissingScore[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  for (const [idStr, weight] of Object.entries(strategy.weights)) {
    const id = idStr as ScoreId;
    if (!weight) continue;
    const result = (IMPLEMENTED_SCORE_IDS as readonly string[]).includes(id) ? byId[id as (typeof IMPLEMENTED_SCORE_IDS)[number]] : undefined;
    if (!result || result.availability === "unavailable" || result.score === null) {
      missingScores.push({ id, label: result?.label ?? id, reason: result?.unavailableReason });
      continue;
    }
    usedScores.push({ id, label: result.label, score: result.score, weight, normalizedWeight: 0 });
    weightedSum += result.score * weight;
    weightTotal += weight;
  }

  if (weightTotal === 0) {
    return {
      strategyId: strategy.id,
      strategyLabel: strategy.label,
      compositeScore: null,
      availability: "unavailable",
      usedScores: [],
      missingScores,
    };
  }

  usedScores.forEach((u) => {
    u.normalizedWeight = u.weight / weightTotal;
  });

  return {
    strategyId: strategy.id,
    strategyLabel: strategy.label,
    compositeScore: Math.round(weightedSum / weightTotal),
    availability: missingScores.length > 0 ? "partial" : "available",
    usedScores,
    missingScores,
  };
}

/** Every defined strategy's result for one instrument — the basis for "warum unterscheiden sich
 *  die Strategien" comparisons in the LLM layer (Etappe 4/5). */
export function applyAllStrategies(analysis: AnalysisResult): StrategyResult[] {
  return STRATEGIES.map((strategy) => applyStrategy(analysis, strategy));
}
