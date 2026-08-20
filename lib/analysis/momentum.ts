import { macd, rsi } from "@/lib/indicators";
import { PricePoint } from "@/lib/types";
import { ScoreFactor, ScoreResult } from "./types";
import { linearScore, piecewiseLinearScore, averageAvailable } from "./scale";
import { toCloseOnlyCandles } from "./candles";

function pctChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return ((to - from) / from) * 100;
}

/**
 * Momentum Score (0-100, higher = stronger positive momentum) from four close-price-derived
 * factors, equal-weighted for now (Etappe 3 moves weighting into the central Strategy config):
 * 30-day and 10-day price change, RSI(14) positioned in its typical trend-strength interpretation,
 * and the MACD(12,26,9) histogram's sign/magnitude relative to price. Any factor whose required
 * history length isn't available is simply left out of the average — the score never guesses a
 * missing factor's value, and if none of the four are available, the whole score is
 * "unavailable" rather than misleadingly 50/neutral.
 */
export function computeMomentumScore(history: PricePoint[]): ScoreResult {
  const factors: ScoreFactor[] = [];
  const componentScores: (number | null)[] = [];

  if (history.length === 0) {
    return {
      id: "momentum",
      label: "Momentum",
      score: null,
      availability: "unavailable",
      unavailableReason: "Keine Kurshistorie vorhanden.",
      factors: [],
    };
  }

  const lastPrice = history[history.length - 1].price;

  // 30-day and 10-day price change — the most direct, least-assumption-laden momentum signal.
  if (history.length > 30) {
    const change30d = pctChange(history[history.length - 1 - 30].price, lastPrice);
    if (change30d !== null) {
      factors.push({ label: "30-Tage-Kursveränderung", value: `${change30d >= 0 ? "+" : ""}${change30d.toFixed(1)} %` });
      componentScores.push(linearScore(change30d, -20, 20));
    }
  }
  if (history.length > 10) {
    const change10d = pctChange(history[history.length - 1 - 10].price, lastPrice);
    if (change10d !== null) {
      factors.push({ label: "10-Tage-Kursveränderung", value: `${change10d >= 0 ? "+" : ""}${change10d.toFixed(1)} %` });
      componentScores.push(linearScore(change10d, -10, 10));
    }
  }

  const candles = toCloseOnlyCandles(history);

  // RSI(14): scored highest around 55-70 (healthy bullish momentum without being extended),
  // penalized both when oversold (weak momentum, even if a bounce is possible) and when deep in
  // overbought territory (momentum strong but stretched, elevated reversal risk).
  const rsiPoints = rsi(candles, 14);
  if (rsiPoints.length > 0) {
    const rsiValue = rsiPoints[rsiPoints.length - 1].value;
    factors.push({ label: "RSI (14)", value: rsiValue.toFixed(1) });
    componentScores.push(
      piecewiseLinearScore(rsiValue, [
        [0, 20],
        [30, 20],
        [50, 55],
        [65, 100],
        [80, 55],
        [100, 20],
      ]),
    );
  }

  // MACD(12,26,9) histogram, normalized to basis points of price so it's comparable across
  // instruments at very different price levels (a $2 histogram means something different for a
  // $20 stock than a $2000 one).
  const macdResult = macd(candles);
  if (macdResult.histogram.length > 0 && lastPrice > 0) {
    const lastHist = macdResult.histogram[macdResult.histogram.length - 1].value;
    const bps = (lastHist / lastPrice) * 10_000;
    factors.push({ label: "MACD-Histogramm", value: `${lastHist >= 0 ? "+" : ""}${lastHist.toFixed(2)} (${bps >= 0 ? "+" : ""}${bps.toFixed(0)} bps)` });
    componentScores.push(piecewiseLinearScore(bps, [[-100, 0], [0, 50], [100, 100]]));
  }

  const score = averageAvailable(componentScores);
  if (score === null) {
    return {
      id: "momentum",
      label: "Momentum",
      score: null,
      availability: "unavailable",
      unavailableReason: `Nur ${history.length} Kurspunkte vorhanden — für keinen der Momentum-Faktoren reicht das aus.`,
      factors: [],
    };
  }

  return { id: "momentum", label: "Momentum", score: Math.round(score), availability: "available", factors };
}
