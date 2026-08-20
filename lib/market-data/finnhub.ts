const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const BASE = "https://finnhub.io/api/v1";

export function isFinnhubConfigured() {
  return Boolean(FINNHUB_KEY);
}

export interface FinnhubQuote {
  price: number;
  changePercent1d: number;
}

/** Real-time quote. Works for US-listed stocks/ETFs/ADRs and BINANCE:xUSDT crypto pairs on the free tier. */
export async function fetchFinnhubQuote(symbol: string): Promise<FinnhubQuote | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`${BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data.c !== "number" || data.c === 0) return null;
    return { price: data.c, changePercent1d: typeof data.dp === "number" ? data.dp : 0 };
  } catch {
    return null;
  }
}

export interface RawNewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  relatedSymbols: string[];
}

interface FinnhubNewsRow {
  id: number;
  headline: string;
  source: string;
  datetime: number;
  summary: string;
  url: string;
  related?: string;
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function mapNewsRow(row: FinnhubNewsRow, relatedSymbols: string[]): RawNewsItem {
  const headline = row.headline.trim();
  const summary = (row.summary ?? "").trim();
  // Finnhub often repeats the headline verbatim as the summary — drop it rather than show duplicate text.
  const distinctSummary = summary && normalize(summary) !== normalize(headline) ? summary : "";
  return {
    id: `fh-${row.id}`,
    title: headline,
    source: row.source,
    publishedAt: new Date(row.datetime * 1000).toISOString(),
    summary: distinctSummary,
    url: row.url,
    relatedSymbols,
  };
}

/** General market news (not tied to a single symbol). */
export async function fetchFinnhubGeneralNews(): Promise<RawNewsItem[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const res = await fetch(`${BASE}/news?category=general&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 25).map((row: FinnhubNewsRow) => mapNewsRow(row, []));
  } catch {
    return [];
  }
}

export interface FinnhubRecommendationCounts {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface FinnhubRecommendationRow {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

/** Analyst recommendation trends (free tier). Stocks only — Finnhub has no equivalent endpoint
 *  for crypto pairs, so this legitimately returns null for BTC/ETH/SOL etc. */
export async function fetchFinnhubRecommendationTrends(symbol: string): Promise<FinnhubRecommendationCounts | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`${BASE}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const data: FinnhubRecommendationRow[] = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    // Rows are returned newest-period-first.
    const latest = data[0];
    return {
      strongBuy: latest.strongBuy ?? 0,
      buy: latest.buy ?? 0,
      hold: latest.hold ?? 0,
      sell: latest.sell ?? 0,
      strongSell: latest.strongSell ?? 0,
    };
  } catch {
    return null;
  }
}

/** News for one specific symbol (last 7 days). */
export async function fetchFinnhubCompanyNews(symbol: string): Promise<RawNewsItem[]> {
  if (!FINNHUB_KEY) return [];
  const to = new Date();
  const from = new Date(Date.now() - 7 * 86_400_000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_KEY}`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.slice(0, 6).map((row: FinnhubNewsRow) => mapNewsRow(row, [symbol]));
  } catch {
    return [];
  }
}
