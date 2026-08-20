import { StrategyDefinition } from "./types";

/**
 * The one central place strategy weights live — per the requirement "kein Hardcoding über viele
 * Dateien verteilt". Adding a strategy is adding an entry here; nothing in lib/strategy/index.ts
 * or the finara-ai tool that calls it needs to change. Weights don't need to sum to 1 — index.ts
 * normalizes by whatever's actually available for a given instrument.
 *
 * Only two strategies for Etappe 3 (feasibility proof, per the phased plan) — Value/Quality/
 * Dividend follow once the fundamentals data they'd need for those weights actually exists
 * (Etappe 6).
 */
export const STRATEGIES: StrategyDefinition[] = [
  {
    id: "momentum",
    label: "Momentum",
    description:
      "Gewichtet starke, bestätigte Kursbewegungen am höchsten — für kurz- bis mittelfristig orientierte Nutzer, die Trends folgen wollen.",
    weights: { momentum: 0.8, risk: 0.2 },
  },
  {
    id: "balanced",
    label: "Balanced",
    description:
      "Gleichgewichtet Momentum und Risiko ohne Präferenz für eine bestimmte Stilrichtung — neutraler Ausgangspunkt.",
    weights: { momentum: 0.5, risk: 0.5 },
  },
  {
    id: "intraday",
    label: "Intraday",
    description:
      "Kurzfristige Wahrscheinlichkeitseinschätzung aus technischer Analyse, Volumen, News-Sentiment, Analysten-Konsens und Marktumfeld — für Fragen wie 'Sollte ich das heute kaufen?'. Eine einzige Gewichtung für alle Asset-Klassen: analystConsensus ist bei Krypto/ETFs strukturell immer unavailable und marketEnvironment aktuell immer unavailable (keine Datenquelle) — die bestehende Renormalisierung in applyStrategy verteilt deren Gewicht automatisch auf die verfügbaren Faktoren, kein separates Krypto-Gewichtsschema nötig.",
    weights: { technical: 0.35, volume: 0.15, sentiment: 0.25, analystConsensus: 0.15, marketEnvironment: 0.1 },
  },
  {
    id: "long-term",
    label: "Langfristig",
    description:
      "Für Anfragen nach einer langfristigen Empfehlung/Einschätzung statt einer kurzfristigen Kauf-heute-Wahrscheinlichkeit. Gegenüber der Intraday-Strategie umgekehrte Gewichtung: Fundamentaldaten (valuation — KGV/PEG/Dividendenrendite/Verschuldungsgrad) sind hier das Hauptkriterium, technische Indikatoren und News-Sentiment (kurzfristiges Rauschen) treten zurück, Analysten-Konsens zählt stärker als im Intraday-Fall. valuation ist strukturell nur für die FMP-Fundamentaldaten-Abdeckung (aktuell NVDA/MSFT/TSLA, siehe lib/analysis/valuation.ts) verfügbar — für jedes andere Symbol renormiert applyStrategy automatisch auf die verbleibenden drei Faktoren, exakt wie beim Intraday-Fall mit analystConsensus/marketEnvironment.",
    weights: { valuation: 0.5, analystConsensus: 0.3, technical: 0.1, sentiment: 0.1 },
  },
];

export function getStrategy(id: string): StrategyDefinition | undefined {
  return STRATEGIES.find((s) => s.id === id);
}
