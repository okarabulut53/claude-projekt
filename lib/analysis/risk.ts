import { PricePoint } from "@/lib/types";
import { ScoreFactor, ScoreResult } from "./types";
import { piecewiseLinearScore, averageAvailable } from "./scale";

/**
 * Risk Score (0-100) — deliberately the opposite direction of what "Risk Score" sounds like at
 * first: here, HIGHER = SAFER (lower realized volatility/drawdown), not higher = riskier. That
 * keeps every score in the Analysis Layer on the same "higher is more favorable" scale, so the
 * Strategy Layer (Etappe 3) can combine them with plain weighted averaging instead of having to
 * flip signs per-score. The raw volatility/drawdown numbers are still exposed unrounded in
 * `factors`, so the LLM layer can describe the actual risk level accurately regardless of which
 * way the composite score points.
 *
 * Two close-price-derived factors, equal-weighted for now (see momentum.ts for the same
 * "Etappe 3 centralizes weights" note): annualized volatility of daily returns, and the maximum
 * peak-to-trough drawdown over the available history.
 */
export function computeRiskScore(history: PricePoint[]): ScoreResult {
  const factors: ScoreFactor[] = [];
  const componentScores: (number | null)[] = [];

  // Below this, a stddev of daily returns is too noisy to mean much (e.g. 3-4 data points could
  // show 0% or 500% annualized vol depending on one bad day) — treat as unavailable rather than
  // publish a misleading number.
  const MIN_POINTS_FOR_VOLATILITY = 10;

  if (history.length >= MIN_POINTS_FOR_VOLATILITY) {
    const returns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].price;
      const cur = history[i].price;
      if (prev > 0 && cur > 0) returns.push(Math.log(cur / prev));
    }
    if (returns.length >= MIN_POINTS_FOR_VOLATILITY - 1) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
      const dailyStdDev = Math.sqrt(variance);
      const annualizedVolPct = dailyStdDev * Math.sqrt(252) * 100;
      factors.push({ label: "Annualisierte Volatilität", value: `${annualizedVolPct.toFixed(1)} %` });
      componentScores.push(
        piecewiseLinearScore(annualizedVolPct, [
          [10, 100],
          [25, 80],
          [40, 55],
          [60, 30],
          [100, 5],
        ]),
      );
    }
  }

  if (history.length >= 2) {
    let peak = history[0].price;
    let maxDrawdownPct = 0;
    for (const point of history) {
      if (point.price > peak) peak = point.price;
      if (peak > 0) {
        const drawdownPct = ((peak - point.price) / peak) * 100;
        if (drawdownPct > maxDrawdownPct) maxDrawdownPct = drawdownPct;
      }
    }
    factors.push({ label: "Maximaler Drawdown (Zeitraum)", value: `-${maxDrawdownPct.toFixed(1)} %` });
    componentScores.push(
      piecewiseLinearScore(maxDrawdownPct, [
        [5, 100],
        [15, 80],
        [30, 55],
        [50, 30],
        [80, 5],
      ]),
    );
  }

  const score = averageAvailable(componentScores);
  if (score === null) {
    return {
      id: "risk",
      label: "Risiko",
      score: null,
      availability: "unavailable",
      unavailableReason: `Nur ${history.length} Kurspunkte vorhanden — für eine belastbare Volatilitäts-/Drawdown-Berechnung reicht das nicht aus.`,
      factors: [],
    };
  }

  return { id: "risk", label: "Risiko", score: Math.round(score), availability: "available", factors };
}
