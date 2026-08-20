import { ScoreResult } from "./types";

/**
 * Market Environment Score — always unavailable. finara has no volatility-index (e.g. VIX) or
 * cross-market-correlation data source wired up (Finnhub/Twelve Data free tiers don't cover
 * this). Per the "never guess a missing factor" rule this stays an explicit, honest stub instead
 * of a fabricated proxy (e.g. deriving a fake VIX-equivalent from the instrument's own
 * volatility, which would just be the risk score wearing a different label) — the Strategy Layer
 * already renormalizes weights around unavailable scores, so this costs nothing downstream.
 */
export function computeMarketEnvironmentScore(): ScoreResult {
  return {
    id: "marketEnvironment",
    label: "Marktumfeld",
    score: null,
    availability: "unavailable",
    unavailableReason:
      "Keine Marktumfeld-/Volatilitätsindex-Datenquelle (z. B. VIX) bzw. Korrelationsdaten angebunden — würde mit einem Tarif-Upgrade ergänzt.",
    factors: [],
  };
}
