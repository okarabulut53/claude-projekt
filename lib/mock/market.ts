import { MarketIndex } from "@/lib/types";
import { generateHistory } from "./random";

const seeds = [
  { symbol: "DAX", name: "DAX", price: 26338 },
  { symbol: "MDAX", name: "MDAX", price: 29800 },
  { symbol: "SPX", name: "S&P 500", price: 6900 },
  { symbol: "NDX", name: "Nasdaq 100", price: 24600 },
];

let cache: MarketIndex[] | null = null;

export function getMarketIndices(): MarketIndex[] {
  if (cache) return cache;
  cache = seeds.map((seed) => {
    const history = generateHistory(seed.symbol, 30, seed.price, 0.009);
    const latest = history[history.length - 1].price;
    const prev = history[history.length - 2].price;
    return {
      symbol: seed.symbol,
      name: seed.name,
      value: latest,
      changePercent1d: ((latest - prev) / prev) * 100,
      history,
    };
  });
  return cache;
}
