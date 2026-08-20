import { ChatMessage } from "@/lib/types";

/** Normalized shape every export format (CSV/DOCX/PPTX) builds from — keeps the format builders
 *  in export.ts ignorant of which present_*-tool the data originally came from. */
export interface ExportRow {
  faktor: string;
  wert: string;
  score: string;
  begruendung: string;
}

export interface ExportableAnalysis {
  instrument: string;
  typ: string;
  datum: string;
  rows: ExportRow[];
  gesamtscore?: string;
  konfidenz?: string;
  bullCase?: string;
  baseCase?: string;
  bearCase?: string;
  summary?: string;
}

function tryParseJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function fromMarketAnalysis(a: Record<string, unknown>): ExportableAnalysis {
  return {
    instrument: asString(a.symbol),
    typ: "Markteinschätzung",
    datum: new Date().toISOString(),
    rows: [
      { faktor: "Trend", wert: "", score: "", begruendung: asString(a.trend) },
      { faktor: "Unterstützung / Widerstand", wert: "", score: "", begruendung: asString(a.supportResistance) },
      { faktor: "Risiko-Einschätzung", wert: "", score: "", begruendung: asString(a.riskAssessment) },
    ],
    bullCase: asString(a.bullCase),
    baseCase: asString(a.baseCase),
    bearCase: asString(a.bearCase),
    summary: asString(a.summary),
  };
}

function fromScoreAnalysis(a: Record<string, unknown>): ExportableAnalysis {
  const indicators = Array.isArray(a.technicalIndicators) ? (a.technicalIndicators as Record<string, unknown>[]) : [];
  const factors = Array.isArray(a.factors) ? (a.factors as Record<string, unknown>[]) : [];
  return {
    instrument: asString(a.symbol),
    typ: "Score-Analyse",
    datum: new Date().toISOString(),
    rows: [
      ...indicators.map((i) => ({ faktor: asString(i.label), wert: asString(i.value), score: "", begruendung: asString(i.signal) })),
      ...factors.map((f) => ({
        faktor: asString(f.label),
        wert: typeof f.weightPercent === "number" ? `${f.weightPercent.toFixed(0)} %` : "",
        score: typeof f.score === "number" ? String(f.score) : "",
        begruendung: asString(f.note),
      })),
    ],
    gesamtscore: typeof a.overallScore === "number" ? String(a.overallScore) : "nicht verfügbar",
    konfidenz: asString(a.confidence),
    summary: asString(a.missingDataNote),
  };
}

function fromSwotAnalysis(a: Record<string, unknown>): ExportableAnalysis {
  const category = (label: string, points: unknown) =>
    (Array.isArray(points) ? points : []).map((p) => ({ faktor: label, wert: "", score: "", begruendung: asString(p) }));
  return {
    instrument: asString(a.symbol),
    typ: "SWOT-Analyse",
    datum: new Date().toISOString(),
    rows: [
      ...category("Stärke", a.strengths),
      ...category("Schwäche", a.weaknesses),
      ...category("Chance", a.opportunities),
      ...category("Risiko", a.risks),
    ],
    summary: asString(a.summary),
  };
}

function fromBullBearAnalysis(a: Record<string, unknown>): ExportableAnalysis {
  const side = (label: string, points: unknown) =>
    (Array.isArray(points) ? points : []).map((p) => ({ faktor: label, wert: "", score: "", begruendung: asString(p) }));
  return {
    instrument: asString(a.symbol),
    typ: "Bullen-vs-Bären-Analyse",
    datum: new Date().toISOString(),
    rows: [...side("Bullish", a.bullPoints), ...side("Bearish", a.bearPoints)],
    summary: asString(a.conclusion),
  };
}

function fromRanking(a: Record<string, unknown>, instrumentLabel: string): ExportableAnalysis {
  const rows = Array.isArray(a.rows) ? (a.rows as Record<string, unknown>[]) : [];
  return {
    instrument: instrumentLabel,
    typ: "Score-Ranking",
    datum: new Date().toISOString(),
    rows: rows.map((r) => ({
      faktor: `${asString(r.rank)}. ${asString(r.symbol)}`,
      wert: asString(r.name),
      score: typeof r.compositeScore === "number" ? String(r.compositeScore) : "",
      begruendung: asString(r.driver),
    })),
    summary: asString(a.scopeNote),
  };
}

const singleInstrumentBuilders: Record<string, (a: Record<string, unknown>) => ExportableAnalysis> = {
  market_analysis: fromMarketAnalysis,
  score_analysis: fromScoreAnalysis,
  swot_analysis: fromSwotAnalysis,
  bull_bear_analysis: fromBullBearAnalysis,
};

/**
 * Finds the most recent structured analysis in the stored thread history that matches
 * `instrumentHint`. present_*-tool replies are stored verbatim as raw JSON strings by
 * appendChatMessage — no separate "structured store" is needed, this just re-reads what's
 * already persisted for the conversation.
 */
export function findExportableAnalysis(history: ChatMessage[], instrumentHint: string): ExportableAnalysis | null {
  const hint = instrumentHint.trim().toUpperCase();

  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.role !== "assistant") continue;
    const parsed = tryParseJson(message.content);
    if (!parsed) continue;

    const type = asString(parsed.type);
    const builder = singleInstrumentBuilders[type];
    if (builder && asString(parsed.symbol).toUpperCase() === hint) {
      return builder(parsed);
    }
    if (type === "ranking") {
      const rows = Array.isArray(parsed.rows) ? (parsed.rows as Record<string, unknown>[]) : [];
      const row = rows.find((r) => asString(r.symbol).toUpperCase() === hint);
      if (row) {
        return {
          instrument: asString(row.symbol),
          typ: "Score-Ranking (Einzelposition)",
          datum: new Date().toISOString(),
          rows: [
            {
              faktor: asString(row.symbol),
              wert: asString(row.name),
              score: typeof row.compositeScore === "number" ? String(row.compositeScore) : "",
              begruendung: asString(row.driver),
            },
          ],
          summary: asString(parsed.scopeNote),
        };
      }
    }
  }

  // No single-instrument match — fall back to the most recent ranking/watchlist overview as a
  // whole, since a request like "export das als CSV" right after a ranking has no single symbol.
  for (let i = history.length - 1; i >= 0; i--) {
    const message = history[i];
    if (message.role !== "assistant") continue;
    const parsed = tryParseJson(message.content);
    if (!parsed) continue;
    if (asString(parsed.type) === "ranking") return fromRanking(parsed, instrumentHint || "Score-Ranking");
  }

  return null;
}
