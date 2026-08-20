import { ScoreFactor, ScoreResult } from "./types";
import { linearScore } from "./scale";

export interface SentimentNewsInput {
  title: string;
  summary: string;
}

/**
 * Deterministic keyword lexicon, DE + EN finance vocabulary. Deliberately NOT an LLM call — the
 * project's core rule ("jede Zahl im Chat muss 1:1 aus einem berechneten Wert stammen") applies
 * to sentiment just like every other score, so this stays a plain, auditable word-count model
 * instead of an invented "AI sentiment" number.
 */
const POSITIVE_KEYWORDS = [
  "übertrifft", "übertreffen", "wachstum", "steigt", "gewinn", "rekord", "stark", "aufschwung",
  "positiv", "zuflüsse", "kurszielerhöhung", "hebt an", "erholung", "optimismus", "expandiert",
  "outperformance", "kaufempfehlung", "rally", "aufwärtstrend", "erfolg",
  "beats", "growth", "surges", "surge", "profit", "record", "strong", "upgrade", "bullish",
  "outperform", "gains", "rises", "optimism", "expansion", "breakthrough", "upbeat", "exceeds",
  "boosts", "soars", "rebound",
];

const NEGATIVE_KEYWORDS = [
  "verfehlt", "rückgang", "sinkt", "verlust", "schwach", "abschwung", "negativ", "abflüsse",
  "kurszielsenkung", "senkt", "warnung", "sorge", "risiko", "einbruch", "krise", "abwärtstrend",
  "enttäuschung", "herabstufung", "klage", "ermittlung",
  "misses", "decline", "falls", "loss", "weak", "downgrade", "bearish", "underperform", "drops",
  "warning", "concern", "crash", "crisis", "disappointment", "lawsuit", "investigation", "slump",
  "plunge", "recession",
];

function countHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
    if (matches) hits += matches.length;
  }
  return hits;
}

/**
 * Sentiment Score (0-100, higher = more positive news tone) from a deterministic positive/
 * negative keyword count across the given news items' titles + summaries. Unavailable when no
 * news items are supplied or none contain a recognized keyword — never defaults to a neutral 50
 * as if that were a measured value.
 */
export function computeSentimentScore(newsItems: SentimentNewsInput[]): ScoreResult {
  if (newsItems.length === 0) {
    return {
      id: "sentiment",
      label: "News-Sentiment",
      score: null,
      availability: "unavailable",
      unavailableReason: "Keine News-Treffer für dieses Instrument verfügbar.",
      factors: [],
    };
  }

  const text = newsItems.map((n) => `${n.title} ${n.summary}`).join(" ").toLowerCase();
  const positiveHits = countHits(text, POSITIVE_KEYWORDS);
  const negativeHits = countHits(text, NEGATIVE_KEYWORDS);
  const totalHits = positiveHits + negativeHits;

  if (totalHits === 0) {
    return {
      id: "sentiment",
      label: "News-Sentiment",
      score: null,
      availability: "unavailable",
      unavailableReason: `${newsItems.length} News-Treffer vorhanden, aber keiner enthält ein erkanntes Sentiment-Schlagwort.`,
      factors: [],
    };
  }

  const netRatio = (positiveHits - negativeHits) / totalHits;
  const factors: ScoreFactor[] = [
    { label: "Analysierte News-Treffer", value: String(newsItems.length) },
    { label: "Positive Schlagwort-Treffer", value: String(positiveHits) },
    { label: "Negative Schlagwort-Treffer", value: String(negativeHits) },
  ];

  const score = linearScore(netRatio, -1, 1);
  return { id: "sentiment", label: "News-Sentiment", score: Math.round(score), availability: "available", factors };
}
