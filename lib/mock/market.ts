import { MarketIndex } from "@/lib/types";
import { generateHistory } from "./random";

const seeds = [
  { symbol: "DAX", name: "DAX", price: 19850 },
  { symbol: "MDAX", name: "MDAX", price: 27340 },
  { symbol: "SPX", name: "S&P 500", price: 6120 },
  { symbol: "NDX", name: "Nasdaq 100", price: 21870 },
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
