/**
 * Analysis Layer types. See CLAUDE.md/the finara analysis-phase discussion for the target
 * architecture: Data Layer → Analysis Layer → Strategy Layer → Score → LLM explains. This layer
 * computes scores from real data only — it never estimates a value that isn't actually derivable
 * from what's on hand, and the LLM layer (not built yet) is only ever allowed to explain a
 * ScoreResult that already exists, never invent one.
 */

export type FactorAvailability = "available" | "unavailable";

/** One human-readable, pre-formatted input that went into a score — the deterministic "why",
 *  for the LLM layer to quote later instead of guessing. Never a raw unformatted number, so a
 *  tool result can be handed straight to the model without it needing to do its own formatting
 *  (and risk silently "helping" by rounding/estimating). */
export interface ScoreFactor {
  label: string;
  value: string;
}

export interface ScoreResult {
  id: string;
  label: string;
  /** 0-100, or null when `availability` is "unavailable" — never a guessed placeholder number. */
  score: number | null;
  availability: FactorAvailability;
  /** Set only when availability is "unavailable" — explains what data was missing, e.g. "Nur 12
   *  Kurspunkte vorhanden, mindestens 31 für eine 30-Tage-Änderung nötig." */
  unavailableReason?: string;
  factors: ScoreFactor[];
}

export interface AnalysisResult {
  symbol: string;
  generatedAt: string;
  scores: {
    momentum: ScoreResult;
    risk: ScoreResult;
    technical: ScoreResult;
    volume: ScoreResult;
    sentiment: ScoreResult;
    analystConsensus: ScoreResult;
    marketEnvironment: ScoreResult;
    /** Fundamentals-derived (KGV/PEG/Dividendenrendite/Verschuldungsgrad), only for the FMP
     *  coverage set (NVDA/MSFT/TSLA) — see lib/analysis/valuation.ts. Unlike the other six scores
     *  this one feeds a single strategy ("long-term", lib/strategy/config.ts), not every one of
     *  them — a short-/medium-term read has no use for a cheap-vs-expensive valuation read. */
    valuation: ScoreResult;
  };
}
