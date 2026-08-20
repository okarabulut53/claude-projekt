import { describe, expect, it } from "vitest";
import { extractLeadingJsonObject, parseStructuredMessage, parseSuggestedFollowUp } from "./structuredMessage";
import { parseSwotAnalysis } from "./SwotAnalysisCard";
import { parseBullBearAnalysis } from "./BullBearAnalysisCard";
import { parseMarketOverview } from "./MarketOverviewCard";
import { parseNewsSummary } from "./NewsSummaryCard";
import { parseWatchlistOverview } from "./WatchlistOverviewCard";
import { parseShortTermComparison } from "./ShortTermComparisonCard";

const swotJson = {
  type: "swot_analysis",
  symbol: "SAP",
  strengths: ["Starkes Momentum"],
  weaknesses: ["Erhöhte Volatilität"],
  opportunities: ["Positives News-Sentiment"],
  risks: ["Marktumfeld nicht verfügbar"],
  summary: "Gemischtes Bild.",
};

const bullBearJson = {
  type: "bull_bear_analysis",
  symbol: "NVDA",
  bullPoints: ["Momentum-Score 82/100"],
  bearPoints: ["Risk-Score 40/100"],
  conclusion: "Beide Seiten haben Argumente.",
};

const marketOverviewJson = {
  type: "market_overview",
  indices: [{ symbol: "DAX", name: "DAX", value: "26.338,00", changePercent1d: "0,42 %" }],
  insight: "Der DAX zeigt sich stabil.",
  unavailable: ["VIX/Volatilitätsindex"],
};

const newsSummaryJson = {
  type: "news_summary",
  scope: "Nachrichten zu SAP",
  items: [{ title: "SAP kündigt Partnerschaft an", source: "manager magazin", publishedAt: "2026-08-20T08:00:00.000Z", relevance: "Moderat positiv." }],
};

const watchlistOverviewJson = {
  type: "watchlist_overview",
  items: [
    {
      symbol: "NVDA",
      name: "NVIDIA Corp.",
      price: "220,13 $",
      changePercent1d: "1,2 %",
      changePercent30d: "8,4 %",
      volatility: "hoch",
      dataSource: "live",
    },
  ],
  insight: "Konzentriert auf wenige, volatile Titel.",
};

describe("parseSwotAnalysis", () => {
  it("parses a real tool_use JSON payload", () => {
    expect(parseSwotAnalysis(JSON.stringify(swotJson))).toEqual(swotJson);
  });
  it("returns null for content of a different card type", () => {
    expect(parseSwotAnalysis(JSON.stringify(bullBearJson))).toBeNull();
  });
  it("returns null for plain prose", () => {
    expect(parseSwotAnalysis("Das ist ein normaler Fließtext ohne JSON.")).toBeNull();
  });
});

describe("parseBullBearAnalysis", () => {
  it("parses a real tool_use JSON payload", () => {
    expect(parseBullBearAnalysis(JSON.stringify(bullBearJson))).toEqual(bullBearJson);
  });
  it("returns null for content of a different card type", () => {
    expect(parseBullBearAnalysis(JSON.stringify(swotJson))).toBeNull();
  });
});

describe("parseMarketOverview", () => {
  it("parses a real tool_use JSON payload", () => {
    expect(parseMarketOverview(JSON.stringify(marketOverviewJson))).toEqual(marketOverviewJson);
  });
  it("returns null when indices is missing", () => {
    expect(parseMarketOverview(JSON.stringify({ type: "market_overview", insight: "x" }))).toBeNull();
  });
  it("recovers from trailing prose the model appended after the JSON object", () => {
    const withTrailingProse = `${JSON.stringify(marketOverviewJson)}\n\nHinweis: Dies ist keine Anlageberatung.`;
    expect(parseMarketOverview(withTrailingProse)).toEqual(marketOverviewJson);
  });
});

describe("parseNewsSummary", () => {
  it("parses a real tool_use JSON payload", () => {
    expect(parseNewsSummary(JSON.stringify(newsSummaryJson))).toEqual(newsSummaryJson);
  });
  it("returns null for content of a different card type", () => {
    expect(parseNewsSummary(JSON.stringify(marketOverviewJson))).toBeNull();
  });
});

describe("parseWatchlistOverview", () => {
  it("parses a real tool_use JSON payload", () => {
    expect(parseWatchlistOverview(JSON.stringify(watchlistOverviewJson))).toEqual(watchlistOverviewJson);
  });
  it("returns null for content of a different card type", () => {
    expect(parseWatchlistOverview(JSON.stringify(newsSummaryJson))).toBeNull();
  });
});

const scoreAnalysisJson = {
  type: "score_analysis",
  symbol: "TSLA",
  instrumentType: "Aktie",
  technicalIndicators: [{ label: "RSI", value: "62", signal: "bullisch" }],
  factors: [{ label: "technical", score: 70, weightPercent: 35, note: "stub" }],
  overallScore: 68,
  confidence: "mittel",
};

const shortTermComparisonJson = {
  type: "shortterm_comparison",
  marketTiming: { exchange: "US", status: "open", minutesToNextChange: 12, nextChangeLabel: "Handelsschluss in 12 Min (16:00 ET)" },
  candidates: [
    {
      symbol: "TSLA",
      name: "Tesla Inc.",
      technicalsByTimeframe: [{ timeframe: "5m", available: true, rsi: 61, macdHistogram: 0.4, adx: 22, stochasticK: 70, signal: "bullisch" }],
      scoreAnalysis: scoreAnalysisJson,
      pros: ["RSI über 60 auf dem 5-Minuten-Chart"],
      cons: ["ADX unter 25 — Trend noch nicht stark ausgeprägt"],
    },
  ],
  verdict: "TSLA zeigt aktuell das stärkere kurzfristige Signal auf dem 5-Minuten-Chart.",
  suggestedFollowUp: "Volumendaten von TSLA genauer analysieren?",
};

describe("parseShortTermComparison", () => {
  it("parses a real tool_use JSON payload, embedding the score analysis 1:1 per candidate", () => {
    const parsed = parseShortTermComparison(JSON.stringify(shortTermComparisonJson));
    expect(parsed).toEqual(shortTermComparisonJson);
    // Regression guard for "keine doppelte/widersprüchliche Score-Berechnung": the embedded
    // scoreAnalysis must be exactly the same object present_score_analysis itself would render —
    // parseShortTermComparison must not recompute or reshape it.
    expect(parsed?.candidates[0].scoreAnalysis).toEqual(scoreAnalysisJson);
  });

  it("returns null for content of a different card type", () => {
    expect(parseShortTermComparison(JSON.stringify(newsSummaryJson))).toBeNull();
  });
});

describe("parseSuggestedFollowUp", () => {
  it("reads suggestedFollowUp generically off any present_*-tool JSON, not just shortterm_comparison", () => {
    expect(parseSuggestedFollowUp(JSON.stringify(shortTermComparisonJson))).toBe("Volumendaten von TSLA genauer analysieren?");
    expect(parseSuggestedFollowUp(JSON.stringify({ ...swotJson, suggestedFollowUp: "Wettbewerbsvergleich?" }))).toBe("Wettbewerbsvergleich?");
  });

  it("returns null when the field is absent, empty, or the content isn't structured JSON at all", () => {
    expect(parseSuggestedFollowUp(JSON.stringify(swotJson))).toBeNull();
    expect(parseSuggestedFollowUp(JSON.stringify({ ...swotJson, suggestedFollowUp: "  " }))).toBeNull();
    expect(parseSuggestedFollowUp("Nur Fließtext, kein JSON.")).toBeNull();
  });
});

describe("extractLeadingJsonObject / parseStructuredMessage", () => {
  it("extracts the leading JSON object when the model appends trailing prose", () => {
    const text = `${JSON.stringify(swotJson)} Das war die Analyse.`;
    expect(extractLeadingJsonObject(text)).toEqual(swotJson);
    expect(parseStructuredMessage(text)).toEqual(swotJson);
  });
  it("returns null for text with no JSON object at all", () => {
    expect(extractLeadingJsonObject("Nur Fließtext, kein JSON.")).toBeNull();
  });
});
