import { NewsItem } from "@/lib/types";
import { cached } from "@/lib/market-data/cache";
import { fetchFinnhubCompanyNews, fetchFinnhubGeneralNews, isFinnhubConfigured } from "@/lib/market-data/finnhub";
import { getAllInstruments } from "./instruments";

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

/** Tags general news items with instrument symbols mentioned by name/symbol in the headline or summary. */
async function tagRelatedSymbols(title: string, summary: string): Promise<string[]> {
  const instruments = await getAllInstruments();
  const haystack = `${title} ${summary}`.toLowerCase();
  return instruments
    .filter((i) => {
      const symbolPattern = new RegExp(`\\b${i.symbol.toLowerCase()}\\b`);
      return symbolPattern.test(haystack) || haystack.includes(i.name.toLowerCase());
    })
    .map((i) => i.symbol);
}

/** Live market-wide headlines for the dashboard feed, falling back to mock news if no API key or the request fails. */
export async function getGeneralMarketNews(): Promise<NewsItem[]> {
  if (!isFinnhubConfigured()) return mockNews;

  const raw = (await cached("news:general", 5 * 60_000, fetchFinnhubGeneralNews)).slice(0, 15);
  if (raw.length === 0) return mockNews;

  const tagged = await Promise.all(
    raw.map(async (item) => ({
      ...item,
      relatedSymbols: await tagRelatedSymbols(item.title, item.summary),
    })),
  );
  return tagged;
}

/** News for a specific instrument: live company news merged with matching mock items as a supplement. */
export async function getNewsForSymbols(symbols: string[]): Promise<NewsItem[]> {
  const fallback = mockNews.filter((n) => n.relatedSymbols.some((s) => symbols.includes(s)));
  if (!isFinnhubConfigured() || symbols.length === 0) return fallback;

  const live = await Promise.all(
    symbols.map((symbol) => cached(`news:company:${symbol}`, 15 * 60_000, () => fetchFinnhubCompanyNews(symbol))),
  );
  const liveFlat = live.flat();
  if (liveFlat.length === 0) return fallback;

  return [...liveFlat, ...fallback];
}
