import { NewsItem } from "@/lib/types";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const mockNews: NewsItem[] = [
  {
    id: "n1",
    title: "EZB signalisiert stabilen Leitzins auf kommender Sitzung",
    source: "Handelsblatt",
    publishedAt: hoursAgo(2),
    relatedSymbols: ["DAX", "SAP", "SIE"],
    summary:
      "Markt reagiert verhalten positiv auf Aussagen zur Geldpolitik, europäische Standardwerte tendieren seitwärts bis leicht fester.",
  },
  {
    id: "n2",
    title: "NVIDIA übertrifft Erwartungen bei Rechenzentrums-Umsatz",
    source: "Reuters",
    publishedAt: hoursAgo(5),
    relatedSymbols: ["NVDA"],
    summary:
      "Starke Nachfrage nach KI-Chips treibt Quartalszahlen, Analysten heben Kursziele an — gleichzeitig bleibt die Bewertung anspruchsvoll.",
  },
  {
    id: "n3",
    title: "Bitcoin konsolidiert nach starkem Wochenstart",
    source: "CoinDesk",
    publishedAt: hoursAgo(7),
    relatedSymbols: ["BTC", "ETH"],
    summary:
      "Nach kräftigen Zuflüssen in Krypto-ETPs pausiert der Markt, Volatilität bleibt erhöht.",
  },
  {
    id: "n4",
    title: "SAP kündigt neue Cloud-Partnerschaft an",
    source: "manager magazin",
    publishedAt: hoursAgo(10),
    relatedSymbols: ["SAP"],
    summary:
      "Kooperation soll Cloud-Wachstum weiter stützen, Marktreaktion bislang moderat positiv.",
  },
  {
    id: "n5",
    title: "Tesla senkt Preise in ausgewählten Märkten",
    source: "Bloomberg",
    publishedAt: hoursAgo(14),
    relatedSymbols: ["TSLA"],
    summary:
      "Maßnahme zur Absatzsteigerung sorgt für gemischte Reaktionen, Margendruck bleibt Diskussionsthema.",
  },
  {
    id: "n6",
    title: "ASML meldet hohen Auftragseingang aus Asien",
    source: "Financial Times",
    publishedAt: hoursAgo(18),
    relatedSymbols: ["ASML"],
    summary:
      "Nachfrage nach Lithografie-Systemen bleibt hoch, langfristige Wachstumsstory intakt laut Analysten.",
  },
  {
    id: "n7",
    title: "US-Inflationsdaten fallen leicht niedriger aus als erwartet",
    source: "Reuters",
    publishedAt: hoursAgo(20),
    relatedSymbols: ["SPX", "NDX"],
    summary:
      "Marktteilnehmer werten Daten als Unterstützung für moderatere Zinserwartungen, Reaktion an US-Börsen positiv.",
  },
  {
    id: "n8",
    title: "Solana-Netzwerk verzeichnet neuen Transaktionsrekord",
    source: "CoinDesk",
    publishedAt: hoursAgo(23),
    relatedSymbols: ["SOL"],
    summary:
      "Steigende On-Chain-Aktivität wird von Beobachtern als positives Signal gewertet, Volatilität bleibt ein Risikofaktor.",
  },
];

export function getNewsForSymbols(symbols: string[]): NewsItem[] {
  return mockNews.filter((n) => n.relatedSymbols.some((s) => symbols.includes(s)));
}
