import { Instrument } from "@/lib/types";
import { generateHistory } from "./random";

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

function buildInstrument(seed: InstrumentSeed): Instrument {
  const history = generateHistory(seed.symbol, 90, seed.price * 0.9, volatilityFactor[seed.volatility]);
  const latest = history[history.length - 1].price;
  const prev1d = history[history.length - 2]?.price ?? latest;
  const prev30d = history[Math.max(history.length - 31, 0)].price;
  return {
    symbol: seed.symbol,
    name: seed.name,
    assetClass: seed.assetClass,
    currency: seed.currency,
    price: latest,
    changePercent1d: ((latest - prev1d) / prev1d) * 100,
    changePercent30d: ((latest - prev30d) / prev30d) * 100,
    volatility: seed.volatility,
    history,
  };
}

const instrumentCache = new Map<string, Instrument>();

export function getAllInstruments(): Instrument[] {
  return seeds.map((seed) => {
    const cached = instrumentCache.get(seed.symbol);
    if (cached) return cached;
    const instrument = buildInstrument(seed);
    instrumentCache.set(seed.symbol, instrument);
    return instrument;
  });
}

export function getInstrument(symbol: string): Instrument | undefined {
  return getAllInstruments().find((i) => i.symbol.toLowerCase() === symbol.toLowerCase());
}

export function searchInstruments(query: string): Instrument[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllInstruments().filter(
    (i) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
  );
}
