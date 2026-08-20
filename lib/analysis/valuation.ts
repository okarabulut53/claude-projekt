import { ScoreFactor, ScoreResult } from "./types";
import { piecewiseLinearScore, averageAvailable } from "./scale";

/** The subset of FmpFundamentalsSummary (lib/data-providers/fmp.ts) this score actually uses —
 *  kept as a narrow local shape instead of importing the FMP type directly so the Analysis Layer
 *  stays free of a data-provider dependency, same reasoning as momentum.ts/risk.ts taking plain
 *  PricePoint[] rather than an Instrument. */
export interface ValuationInput {
  peRatio: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
}

/**
 * Valuation Score (0-100, higher = more attractively valued for a LONG-TERM hold) — the one
 * fundamentals-based score in the Analysis Layer, added for the "long-term" strategy
 * (lib/strategy/config.ts). Deliberately excluded from every other strategy (Momentum/Balanced/
 * Intraday): those are short-to-medium-term reads where a cheap valuation is not the point.
 *
 * Only ever computed for the narrow FMP coverage set (NVDA/MSFT/TSLA, see
 * FUNDAMENTALS_COVERED_SYMBOLS in lib/data-providers/fmp.ts) — `input` is null for every other
 * symbol, which this reports as `unavailable` rather than guessing a mid-range score. That means
 * a "long-term" ranking over the full candidate list will renormalize away from this factor for
 * most candidates (same missing-factor handling as every other score here) and only actually
 * differentiate on valuation for the 3 covered symbols — an honest limitation, not hidden.
 *
 * KGV/PEG/Verschuldungsgrad: lower is more attractive (cheaper relative to earnings/growth, less
 * leveraged). Dividendenrendite: higher is more attractive for a long-term/income-oriented read.
 * A non-positive KGV/PEG (loss-making company or negative growth) is excluded from the score
 * rather than scored as "cheap" — a P/E of -5 is not more attractive than a P/E of 15.
 */
export function computeValuationScore(input: ValuationInput | null): ScoreResult {
  if (!input) {
    return {
      id: "valuation",
      label: "Bewertung (Fundamentaldaten)",
      score: null,
      availability: "unavailable",
      unavailableReason:
        "Keine Fundamentaldaten verfügbar — finara deckt KGV/PEG/Verschuldungsgrad/Dividendenrendite aktuell nur für NVDA, MSFT und TSLA vollständig ab.",
      factors: [],
    };
  }

  const factors: ScoreFactor[] = [];
  const componentScores: (number | null)[] = [];

  if (input.peRatio !== null) {
    factors.push({ label: "KGV", value: input.peRatio.toFixed(1) });
    if (input.peRatio > 0) {
      componentScores.push(
        piecewiseLinearScore(input.peRatio, [
          [5, 100],
          [15, 85],
          [25, 60],
          [40, 35],
          [80, 10],
        ]),
      );
    }
  }

  if (input.pegRatio !== null) {
    factors.push({ label: "PEG-Verhältnis", value: input.pegRatio.toFixed(2) });
    if (input.pegRatio > 0) {
      componentScores.push(
        piecewiseLinearScore(input.pegRatio, [
          [0.5, 100],
          [1, 85],
          [1.5, 65],
          [2, 45],
          [3, 20],
          [5, 5],
        ]),
      );
    }
  }

  if (input.dividendYield !== null) {
    factors.push({ label: "Dividendenrendite", value: `${(input.dividendYield * 100).toFixed(2)} %` });
    componentScores.push(
      piecewiseLinearScore(input.dividendYield, [
        [0, 40],
        [0.01, 55],
        [0.02, 70],
        [0.035, 85],
        [0.05, 100],
      ]),
    );
  }

  if (input.debtToEquity !== null) {
    factors.push({ label: "Verschuldungsgrad (Debt/Equity)", value: input.debtToEquity.toFixed(2) });
    componentScores.push(
      piecewiseLinearScore(input.debtToEquity, [
        [0, 100],
        [0.5, 85],
        [1, 65],
        [2, 40],
        [4, 15],
      ]),
    );
  }

  const score = averageAvailable(componentScores);
  if (score === null) {
    return {
      id: "valuation",
      label: "Bewertung (Fundamentaldaten)",
      score: null,
      availability: "unavailable",
      unavailableReason: "Fundamentaldaten für dieses Symbol geladen, aber keine der Kennzahlen (KGV/PEG/Dividendenrendite/Verschuldungsgrad) auswertbar (z. B. negatives KGV/PEG bei einem verlustschreibenden Unternehmen).",
      factors,
    };
  }

  return { id: "valuation", label: "Bewertung (Fundamentaldaten)", score: Math.round(score), availability: "available", factors };
}
