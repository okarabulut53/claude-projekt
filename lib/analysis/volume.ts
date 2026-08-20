import { PricePoint } from "@/lib/types";
import { ScoreFactor, ScoreResult } from "./types";
import { piecewiseLinearScore } from "./scale";

const MIN_POINTS_FOR_AVERAGE = 10;

/**
 * Volume Score (0-100, higher = more bullish confirmation) from today's volume vs. the trailing
 * 30-day average — a simple relative-volume read, not a full volume-profile analysis. Needs
 * PricePoint.volume, which is only populated when the data source actually reports it (Twelve
 * Data OHLCV for live instruments, a seeded synthetic series for simulated ones — see
 * lib/mock/random.ts) — undefined volume points are excluded from the average rather than
 * treated as a real zero.
 */
export function computeVolumeScore(history: PricePoint[]): ScoreResult {
  const withVolume = history.filter((p): p is PricePoint & { volume: number } => typeof p.volume === "number");

  if (withVolume.length < MIN_POINTS_FOR_AVERAGE) {
    return {
      id: "volume",
      label: "Volumen",
      score: null,
      availability: "unavailable",
      unavailableReason:
        withVolume.length === 0
          ? "Keine Volumendaten für dieses Instrument verfügbar."
          : `Nur ${withVolume.length} Kurspunkte mit Volumendaten — für einen belastbaren 30-Tage-Durchschnitt reicht das nicht aus.`,
      factors: [],
    };
  }

  const today = withVolume[withVolume.length - 1].volume;
  const window = withVolume.slice(-31, -1);
  if (window.length === 0) {
    return {
      id: "volume",
      label: "Volumen",
      score: null,
      availability: "unavailable",
      unavailableReason: "Kein 30-Tage-Vergleichszeitraum mit Volumendaten verfügbar.",
      factors: [],
    };
  }

  const avg30d = window.reduce((sum, p) => sum + p.volume, 0) / window.length;
  const factors: ScoreFactor[] = [
    { label: "Heutiges Volumen", value: today.toLocaleString("de-DE") },
    { label: "30-Tage-Durchschnittsvolumen", value: Math.round(avg30d).toLocaleString("de-DE") },
  ];

  if (avg30d <= 0) {
    return {
      id: "volume",
      label: "Volumen",
      score: null,
      availability: "unavailable",
      unavailableReason: "30-Tage-Durchschnittsvolumen ist 0 — kein sinnvolles Verhältnis berechenbar.",
      factors,
    };
  }

  const ratio = today / avg30d;
  factors.push({ label: "Verhältnis heute/30-Tage-Ø", value: `${ratio.toFixed(2)}×` });

  const score = piecewiseLinearScore(ratio, [
    [0.5, 30],
    [1, 50],
    [1.5, 70],
    [2.5, 90],
  ]);

  return { id: "volume", label: "Volumen", score: Math.round(score), availability: "available", factors };
}
