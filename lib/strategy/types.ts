import { ScoreResult } from "@/lib/analysis";

/**
 * IDs of every score the Analysis Layer can produce. Only "momentum"/"risk" are implemented
 * (Etappe 2) — the rest are listed now so strategy weight objects can reference them ahead of
 * time (as 0 or omitted) without a later restructure once Etappe 6 adds real
 * quality/growth/valuation/macro/portfolioFit scores. Adding a new score later only means:
 * add it to AnalysisResult.scores, add it here, and set nonzero weights in config.ts — no
 * change to the combination logic in index.ts.
 */
export type ScoreId =
  | "momentum"
  | "risk"
  | "technical"
  | "volume"
  | "sentiment"
  | "analystConsensus"
  | "marketEnvironment"
  | "quality"
  | "growth"
  | "valuation"
  | "macro"
  | "portfolioFit";

/** Score ids the Analysis Layer actually implements today — see lib/analysis/index.ts's
 *  AnalysisResult.scores. The remaining ScoreId members (quality/growth/macro/portfolioFit) are
 *  reserved for future strategies and have no computed ScoreResult yet. "valuation" was the first
 *  of these reserved ids to actually get implemented (lib/analysis/valuation.ts, for the
 *  "long-term" strategy) — exactly the "add it to AnalysisResult.scores, add it here, set nonzero
 *  weights in config.ts" path this comment originally anticipated. */
export const IMPLEMENTED_SCORE_IDS = [
  "momentum",
  "risk",
  "technical",
  "volume",
  "sentiment",
  "analystConsensus",
  "marketEnvironment",
  "valuation",
] as const satisfies readonly ScoreId[];

export interface StrategyDefinition {
  id: string;
  label: string;
  description: string;
  /** Only nonzero entries are needed — an omitted score id has weight 0. */
  weights: Partial<Record<ScoreId, number>>;
}

export interface StrategyScoreUsage {
  id: ScoreId;
  label: string;
  score: number;
  weight: number;
  normalizedWeight: number;
}

export interface StrategyMissingScore {
  id: ScoreId;
  label: string;
  reason?: string;
}

export interface StrategyResult {
  strategyId: string;
  strategyLabel: string;
  /** 0-100, or null when no weighted score was available at all. */
  compositeScore: number | null;
  /** "available": every weighted score was available. "partial": some were missing but at least
   *  one was available (compositeScore is a renormalized average of what's left — not silently
   *  treating the missing ones as 0). "unavailable": nothing was available at all. */
  availability: "available" | "partial" | "unavailable";
  usedScores: StrategyScoreUsage[];
  missingScores: StrategyMissingScore[];
}

export type AnalysisScores = Record<(typeof IMPLEMENTED_SCORE_IDS)[number], ScoreResult>;
