import { Instrument, PricePoint } from "@/lib/types";
import { generateHistory } from "./random";
import { cached } from "@/lib/market-data/cache";
import { fetchFinnhubQuote, isFinnhubConfigured } from "@/lib/market-data/finnhub";
import { fetchTwelveDataHistory, fetchTwelveDataOhlcv } from "@/lib/market-data/twelvedata";
import { liveSymbols } from "@/lib/market-data/symbols";

interface InstrumentSeed {
  symbol: string;
  name: string;
  assetClass: Instrument["assetClass"];
  currency: Instrument["currency"];
  price: number;
  volatility: Instrument["volatility"];
}

const seeds: InstrumentSeed[] = [
  { symbol: "SAP", name: "SAP SE", assetClass: "stock", currency: "EUR", price: 218.4, volatility: "niedrig" },
  { symbol: "SIE", name: "Siemens AG", assetClass: "stock", currency: "EUR", price: 189.2, volatility: "niedrig" },
  { symbol: "ALV", name: "Allianz SE", assetClass: "stock", currency: "EUR", price: 312.7, volatility: "niedrig" },
  { symbol: "DTE", name: "Deutsche Telekom AG", assetClass: "stock", currency: "EUR", price: 27.8, volatility: "niedrig" },
  { symbol: "NVDA", name: "NVIDIA Corp.", assetClass: "stock", currency: "USD", price: 182.3, volatility: "hoch" },
  { symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stock", currency: "USD", price: 468.1, volatility: "mittel" },
  { symbol: "TSLA", name: "Tesla Inc.", assetClass: "stock", currency: "USD", price: 264.9, volatility: "hoch" },
  { symbol: "ASML", name: "ASML Holding", assetClass: "stock", currency: "EUR", price: 741.5, volatility: "mittel" },
  { symbol: "IUSA", name: "iShares Core S&P 500 UCITS ETF", assetClass: "etf", currency: "EUR", price: 106.3, volatility: "niedrig" },
  { symbol: "EXW1", name: "iShares Core DAX UCITS ETF", assetClass: "etf", currency: "EUR", price: 178.9, volatility: "niedrig" },
  { symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", assetClass: "etf", currency: "EUR", price: 132.6, volatility: "niedrig" },
  { symbol: "BTC", name: "Bitcoin", assetClass: "crypto", currency: "USD", price: 71420, volatility: "hoch" },
  { symbol: "ETH", name: "Ethereum", assetClass: "crypto", currency: "USD", price: 3840, volatility: "hoch" },
  { symbol: "SOL", name: "Solana", assetClass: "crypto", currency: "USD", price: 198.4, volatility: "hoch" },
];

const volatilityFactor: Record<Instrument["volatility"], number> = {
  niedrig: 0.012,
  mittel: 0.022,
  hoch: 0.045,
};

function changeFromHistory(history: { price: number }[], latest: number, daysBack: number) {
  const reference = history[Math.max(history.length - 1 - daysBack, 0)]?.price ?? latest;
  return reference > 0 ? ((latest - reference) / reference) * 100 : 0;
}

function buildMockInstrument(seed: InstrumentSeed): Instrument {
  const history = generateHistory(seed.symbol, 90, seed.price * 0.9, volatilityFactor[seed.volatility]);
  const latest = history[history.length - 1].price;
  return {
    symbol: seed.symbol,
    name: seed.name,
    assetClass: seed.assetClass,
    currency: seed.currency,
    price: latest,
    changePercent1d: changeFromHistory(history, latest, 1),
    changePercent30d: changeFromHistory(history, latest, 30),
    volatility: seed.volatility,
    history,
    source: "simulated",
  };
}

/** Best-effort daily volume, keyed by "yyyy-mm-dd", from Twelve Data's OHLCV endpoint (the
 *  close-only fetchTwelveDataHistory above discards volume entirely). Returns null on any
 *  failure — callers must treat that as "volume unavailable for this call", not retry inline. */
async function fetchLiveVolumeByDate(seedSymbol: string, twelveDataSymbol: string): Promise<Map<string, number> | null> {
  const result = await cached(`ohlcv:${seedSymbol}`, 6 * 3600_000, () => fetchTwelveDataOhlcv(twelveDataSymbol, "1day", 90));
  if (!result.ok) return null;
  const byDate = new Map<string, number>();
  for (const bar of result.bars) {
    const volume = Number(bar.volume);
    if (Number.isFinite(volume)) byDate.set(bar.datetime.slice(0, 10), volume);
  }
  return byDate;
}

function withVolume(history: PricePoint[], volumeByDate: Map<string, number> | null): PricePoint[] {
  if (!volumeByDate) return history;
  return history.map((p) => {
    const volume = volumeByDate.get(p.date.slice(0, 10));
    return volume !== undefined ? { ...p, volume } : p;
  });
}

async function buildLiveInstrument(seed: InstrumentSeed): Promise<Instrument | null> {
  const map = liveSymbols[seed.symbol];
  if (!map || !isFinnhubConfigured()) return null;

  const quote = await cached(`quote:${seed.symbol}`, 60_000, () => fetchFinnhubQuote(map.finnhub));
  if (!quote) return null;

  const history = await cached(`history:${seed.symbol}`, 6 * 3600_000, () =>
    fetchTwelveDataHistory(map.twelveData, 90),
  );

  const finalHistory =
    history && history.length > 5
      ? history
      : generateHistory(seed.symbol, 90, quote.price * 0.9, volatilityFactor[seed.volatility]).map((p, i, arr) =>
          i === arr.length - 1 ? { ...p, price: quote.price } : p,
        );

  const volumeByDate = await fetchLiveVolumeByDate(seed.symbol, map.twelveData);
  const historyWithVolume = withVolume(finalHistory, volumeByDate);

  return {
    symbol: seed.symbol,
    name: seed.name,
    assetClass: seed.assetClass,
    currency: map.currency,
    price: quote.price,
    changePercent1d: quote.changePercent1d,
    changePercent30d: changeFromHistory(finalHistory, quote.price, 30),
    volatility: seed.volatility,
    history: historyWithVolume,
    source: "live",
  };
}

async function buildInstrument(seed: InstrumentSeed): Promise<Instrument> {
  return (await buildLiveInstrument(seed)) ?? buildMockInstrument(seed);
}

export async function getAllInstruments(): Promise<Instrument[]> {
  return Promise.all(seeds.map((seed) => cached(`instrument:${seed.symbol}`, 60_000, () => buildInstrument(seed))));
}

export async function getInstrument(symbol: string): Promise<Instrument | undefined> {
  const instruments = await getAllInstruments();
  return instruments.find((i) => i.symbol.toLowerCase() === symbol.toLowerCase());
}

export async function searchInstruments(query: string): Promise<Instrument[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const instruments = await getAllInstruments();
  return instruments.filter((i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
}
