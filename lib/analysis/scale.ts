/**
 * Deterministic score-scaling helpers shared by every factor in the Analysis Layer. Thresholds
 * live next to the function that uses them (momentum.ts/risk.ts) rather than here, so they stay
 * next to their rationale — this file only has the generic math. Etappe 3 (Strategy Layer) will
 * move the *weights* between factors into a central config; these per-factor calibration curves
 * are a separate, lower-level concern and can reasonably stay local until there's a real need to
 * tune them per strategy.
 */

/** Linear interpolation from [lo, hi] to [0, 100], clamped at both ends. */
export function linearScore(value: number, lo: number, hi: number): number {
  if (hi === lo) return 50;
  const t = (value - lo) / (hi - lo);
  return Math.max(0, Math.min(100, t * 100));
}

/** Piecewise-linear interpolation through a set of (x, score) breakpoints, clamped to the first/
 *  last breakpoint's score outside the defined range. Breakpoints must be sorted by x ascending. */
export function piecewiseLinearScore(value: number, points: [x: number, score: number][]): number {
  if (points.length === 0) return 50;
  if (value <= points[0][0]) return points[0][1];
  if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (value >= x0 && value <= x1) {
      const t = x1 === x0 ? 0 : (value - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

/** Mean of the available (non-null) numbers, or null if none are available — used to combine a
 *  score's individual factor scores without letting a missing factor silently count as zero. */
export function averageAvailable(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}
