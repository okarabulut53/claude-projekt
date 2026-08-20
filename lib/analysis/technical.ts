import { adx, bollingerBands, macd, rsi, sma, stochastic } from "@/lib/indicators";
import { PricePoint } from "@/lib/types";
import { ScoreFactor, ScoreResult } from "./types";
import { piecewiseLinearScore, averageAvailable } from "./scale";
import { toCloseOnlyCandles } from "./candles";

/**
 * Technical Score (0-100, higher = more bullish) — a distinct, more granular sibling to
 * momentum.ts's Momentum Score. Momentum blends raw price change with a light RSI/MACD read for
 * a medium-term "is this trending well" view; this score is the specific 6-indicator blend
 * (RSI/MACD/SMA/Bollinger/Stochastic/ADX) used for short-horizon (intraday-style) probability
 * reads — it never looks at raw price change directly. Weights: RSI 20%, MACD 20%, SMA 20%,
 * Bollinger 15%, Stochastic 15%, ADX 10%. Same "missing factor drops out of the average, never
 * counted as 0" rule as every other score in this layer.
 */
export function computeTechnicalScore(history: PricePoint[]): ScoreResult {
  const factors: ScoreFactor[] = [];
  const componentScores: (number | null)[] = [];

  if (history.length === 0) {
    return {
      id: "technical",
      label: "Technisch",
      score: null,
      availability: "unavailable",
      unavailableReason: "Keine Kurshistorie vorhanden.",
      factors: [],
    };
  }

  const lastPrice = history[history.length - 1].price;
  const candles = toCloseOnlyCandles(history);

  // RSI(14) — same curve as momentum.ts's RSI factor (peak around 55-70, penalized at both
  // extremes).
  const rsiPoints = rsi(candles, 14);
  if (rsiPoints.length > 0) {
    const value = rsiPoints[rsiPoints.length - 1].value;
    factors.push({ label: "RSI (14)", value: value.toFixed(1) });
    componentScores.push(
      piecewiseLinearScore(value, [
        [0, 20],
        [30, 20],
        [50, 55],
        [65, 100],
        [80, 55],
        [100, 20],
      ]),
    );
  } else {
    factors.push({ label: "RSI (14)", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  // MACD(12,26,9) histogram, normalized to bps of price — same curve as momentum.ts.
  const macdResult = macd(candles);
  if (macdResult.histogram.length > 0 && lastPrice > 0) {
    const lastHist = macdResult.histogram[macdResult.histogram.length - 1].value;
    const bps = (lastHist / lastPrice) * 10_000;
    factors.push({ label: "MACD-Histogramm", value: `${lastHist >= 0 ? "+" : ""}${lastHist.toFixed(2)} (${bps >= 0 ? "+" : ""}${bps.toFixed(0)} bps)` });
    componentScores.push(piecewiseLinearScore(bps, [[-100, 0], [0, 50], [100, 100]]));
  } else {
    factors.push({ label: "MACD", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  // SMA 20/50/200: for each available MA, score the price's % distance from it (±10% clamped to
  // 0-100), then average what's available. A 4th sub-factor — the SMA50-vs-SMA200 spread — reads
  // as a continuous Golden/Death Cross signal instead of needing to detect the crossing instant.
  const smaScores: number[] = [];
  const smaLabels: string[] = [];
  for (const period of [20, 50, 200] as const) {
    const points = sma(candles, period);
    if (points.length === 0) continue;
    const maValue = points[points.length - 1].value;
    if (maValue <= 0) continue;
    const distPct = ((lastPrice - maValue) / maValue) * 100;
    smaScores.push(piecewiseLinearScore(distPct, [[-10, 0], [0, 50], [10, 100]]));
    smaLabels.push(`SMA${period} ${distPct >= 0 ? "+" : ""}${distPct.toFixed(1)} %`);
  }
  const sma50Points = sma(candles, 50);
  const sma200Points = sma(candles, 200);
  if (sma50Points.length > 0 && sma200Points.length > 0) {
    const sma50 = sma50Points[sma50Points.length - 1].value;
    const sma200 = sma200Points[sma200Points.length - 1].value;
    if (sma200 > 0) {
      const spreadPct = ((sma50 - sma200) / sma200) * 100;
      smaScores.push(piecewiseLinearScore(spreadPct, [[-5, 0], [0, 50], [5, 100]]));
      smaLabels.push(`SMA50/200-Spread ${spreadPct >= 0 ? "+" : ""}${spreadPct.toFixed(1)} % (${spreadPct >= 0 ? "Golden-Cross-Richtung" : "Death-Cross-Richtung"})`);
    }
  }
  if (smaScores.length > 0) {
    factors.push({ label: "Gleitende Durchschnitte (SMA 20/50/200)", value: smaLabels.join(", ") });
    componentScores.push(averageAvailable(smaScores));
  } else {
    factors.push({ label: "Gleitende Durchschnitte (SMA 20/50/200)", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  // Bollinger Bands (20, 2): %B position within the band. Below the lower band (< 0) reads as
  // oversold/bounce-likely (scored high), above the upper band (> 1) as overbought (scored low) —
  // same "extremes get penalized/rewarded" shape as RSI, applied to band position instead.
  const bands = bollingerBands(candles, 20, 2);
  if (bands.upper.length > 0 && bands.lower.length > 0) {
    const upper = bands.upper[bands.upper.length - 1].value;
    const lower = bands.lower[bands.lower.length - 1].value;
    const range = upper - lower;
    if (range > 0) {
      const percentB = (lastPrice - lower) / range;
      factors.push({ label: "Bollinger-Bänder (20, 2)", value: `%B = ${percentB.toFixed(2)}` });
      componentScores.push(
        piecewiseLinearScore(percentB, [
          [-0.5, 85],
          [0, 70],
          [0.5, 50],
          [1, 30],
          [1.5, 15],
        ]),
      );
    } else {
      factors.push({ label: "Bollinger-Bänder (20, 2)", value: "nicht verfügbar (Band ohne Breite)" });
    }
  } else {
    factors.push({ label: "Bollinger-Bänder (20, 2)", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  // Stochastic Oscillator (14, 3, 3): level-based read (same oversold/overbought shape as RSI),
  // blended 70/30 with the %K/%D crossover direction on the latest point.
  const stoch = stochastic(candles, 14, 3);
  if (stoch.k.length > 0) {
    const kValue = stoch.k[stoch.k.length - 1].value;
    const levelScore = piecewiseLinearScore(kValue, [
      [0, 75],
      [20, 75],
      [50, 50],
      [80, 25],
      [100, 25],
    ]);
    let crossoverScore: number | null = null;
    if (stoch.k.length > 1 && stoch.d.length > 1) {
      const kPrev = stoch.k[stoch.k.length - 2].value;
      const dLast = stoch.d[stoch.d.length - 1].value;
      const dPrev = stoch.d[stoch.d.length - 2].value;
      const crossedUp = kPrev <= dPrev && kValue > dLast;
      const crossedDown = kPrev >= dPrev && kValue < dLast;
      crossoverScore = crossedUp ? 100 : crossedDown ? 0 : 50;
    }
    const combined = crossoverScore === null ? levelScore : levelScore * 0.7 + crossoverScore * 0.3;
    factors.push({
      label: "Stochastic (14, 3, 3)",
      value: `%K = ${kValue.toFixed(1)}${crossoverScore !== null ? (crossoverScore === 100 ? ", bullische %K/%D-Kreuzung" : crossoverScore === 0 ? ", bärische %K/%D-Kreuzung" : "") : ""}`,
    });
    componentScores.push(combined);
  } else {
    factors.push({ label: "Stochastic (14, 3, 3)", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  // ADX(14): strength-only, direction comes from comparing +DI/-DI on the latest point. Below 20
  // (no reliable trend) always scores neutral regardless of direction, since there's no trend to
  // be bullish or bearish about.
  const adxResult = adx(candles, 14);
  if (adxResult.adx.length > 0 && adxResult.plusDI.length > 0 && adxResult.minusDI.length > 0) {
    const adxValue = adxResult.adx[adxResult.adx.length - 1].value;
    const plusDI = adxResult.plusDI[adxResult.plusDI.length - 1].value;
    const minusDI = adxResult.minusDI[adxResult.minusDI.length - 1].value;
    const magnitude = piecewiseLinearScore(adxValue, [[0, 50], [20, 50], [25, 65], [60, 90]]);
    const bullish = plusDI > minusDI;
    const directional = bullish ? magnitude : 100 - magnitude;
    factors.push({
      label: "ADX (14)",
      value: `${adxValue.toFixed(1)} (${adxValue < 20 ? "kein klarer Trend" : bullish ? "Trend bullisch" : "Trend bärisch"}, +DI ${plusDI.toFixed(1)} / -DI ${minusDI.toFixed(1)})`,
    });
    componentScores.push(directional);
  } else {
    factors.push({ label: "ADX (14)", value: "nicht verfügbar (zu wenig Kurshistorie)" });
  }

  const score = averageAvailable(componentScores);
  if (score === null) {
    return {
      id: "technical",
      label: "Technisch",
      score: null,
      availability: "unavailable",
      unavailableReason: `Nur ${history.length} Kurspunkte vorhanden — für keinen der technischen Indikatoren reicht das aus.`,
      factors: [],
    };
  }

  return { id: "technical", label: "Technisch", score: Math.round(score), availability: "available", factors };
}
