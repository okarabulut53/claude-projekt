import { AssetClass, PortfolioPosition } from "@/lib/types";

export interface PortfolioAnalysis {
  totalValue: number;
  totalCost: number;
  gainAbs: number;
  gainPct: number;
  allocation: { assetClass: AssetClass; value: number; percent: number }[];
  concentrationNote: string | null;
}

const assetClassLabel: Record<AssetClass, string> = {
  stock: "Aktien",
  etf: "ETFs",
  crypto: "Kryptowährungen",
};

export function analyzePortfolio(positions: PortfolioPosition[]): PortfolioAnalysis {
  const totalValue = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.quantity * p.avgPrice, 0);
  const gainAbs = totalValue - totalCost;
  const gainPct = totalCost > 0 ? (gainAbs / totalCost) * 100 : 0;

  const byClass = new Map<AssetClass, number>();
  for (const position of positions) {
    const value = position.quantity * position.currentPrice;
    byClass.set(position.assetClass, (byClass.get(position.assetClass) ?? 0) + value);
  }

  const allocation = Array.from(byClass.entries())
    .map(([assetClass, value]) => ({
      assetClass,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  let concentrationNote: string | null = null;
  const topAllocation = allocation[0];
  if (topAllocation && topAllocation.percent >= 70 && positions.length > 1) {
    concentrationNote = `${topAllocation.percent.toFixed(0)} % deines Portfolios liegen in ${assetClassLabel[topAllocation.assetClass]}. Das kann ein Konzentrationsrisiko darstellen — eine breitere Streuung über mehrere Anlageklassen könnte das Risiko reduzieren.`;
  } else if (positions.length === 1) {
    concentrationNote =
      "Dein Portfolio besteht aktuell aus einer einzelnen Position. Eine Streuung über mehrere Anlageklassen kann das Risiko einzelner Kursbewegungen abfedern.";
  }

  return { totalValue, totalCost, gainAbs, gainPct, allocation, concentrationNote };
}

export { assetClassLabel };
