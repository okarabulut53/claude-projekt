import Link from "next/link";
import { PortfolioPosition } from "@/lib/types";
import { analyzePortfolio } from "@/lib/portfolio-analysis";
import { Card } from "@/components/ui/Card";
import { ChangeBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

export function PortfolioSnapshot({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-brand-navy">Dein Portfolio</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Noch keine Positionen erfasst — trage dein Depot ein, um Gewinn/Verlust und
              Diversifikation direkt hier im Dashboard zu sehen.
            </p>
          </div>
          <Link
            href="/portfolio"
            className="whitespace-nowrap rounded-full bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal/90"
          >
            Portfolio anlegen
          </Link>
        </div>
      </Card>
    );
  }

  const analysis = analyzePortfolio(positions);
  const topPositions = [...positions]
    .sort((a, b) => b.quantity * b.currentPrice - a.quantity * a.currentPrice)
    .slice(0, 4);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">Dein Portfolio</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-bold text-brand-navy">
              {formatCurrency(analysis.totalValue)}
            </span>
            <ChangeBadge value={analysis.gainPct} />
          </div>
        </div>
        <Link href="/portfolio" className="text-sm font-semibold text-brand-teal hover:underline">
          Alle Positionen &rarr;
        </Link>
      </div>

      <div className="mt-4 divide-y divide-brand-border">
        {topPositions.map((position) => {
          const value = position.quantity * position.currentPrice;
          const cost = position.quantity * position.avgPrice;
          const gainPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
          return (
            <Link
              key={position.id}
              href={`/instrument/${position.symbol}`}
              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:opacity-70"
            >
              <div>
                <div className="text-sm font-semibold text-brand-navy">{position.name}</div>
                <div className="text-xs text-foreground/50">{position.symbol}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{formatCurrency(value)}</div>
                <ChangeBadge value={gainPct} />
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
