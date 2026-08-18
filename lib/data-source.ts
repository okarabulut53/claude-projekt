export type DataSource = "live" | "simulated";

/**
 * Single place to turn an Instrument's `source` field into user-facing label/tooltip text —
 * every place that renders a price, chart, or metric should go through this rather than
 * re-deriving its own wording. `source` itself is already resolved server-side wherever an
 * Instrument is built (lib/mock/instruments.ts's buildInstrument: real Twelve Data/Finnhub if
 * the symbol has a live mapping and the fetch succeeds, deterministic mock data otherwise) —
 * this is a presentational lookup, not a data fetch, so there's no separate hook needed to
 * "go get" the source for a symbol: whatever already fetched the Instrument already has it.
 */
export function getDataSourceInfo(source: DataSource): { label: string; tooltip: string } {
  if (source === "live") {
    return {
      label: "Live-Kurs",
      tooltip: "Echte Marktdaten von Twelve Data/Finnhub.",
    };
  }
  return {
    label: "Simulationsdaten",
    tooltip:
      "Für dieses Symbol liegt aktuell keine Live-Anbindung vor (kein Anbieter-Mapping oder gerade nicht erreichbar, z. B. Rate-Limit) — der Kurs ist deterministisch simuliert, nicht real.",
  };
}
