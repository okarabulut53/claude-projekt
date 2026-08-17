import { MarketIndex } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ChangeBadge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatNumber } from "@/lib/format";

export function MarketOverview({ indices }: { indices: MarketIndex[] }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-brand-navy">Marktüberblick</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indices.map((index) => (
          <div key={index.symbol} className="rounded-xl border border-brand-border p-4">
            <div className="text-xs font-medium text-foreground/50">{index.name}</div>
            <div className="mt-1 text-lg font-bold text-brand-navy">
              {formatNumber(Math.round(index.value))}
            </div>
            <div className="mt-1">
              <ChangeBadge value={index.changePercent1d} />
            </div>
            <div className="mt-2">
              <Sparkline data={index.history} positive={index.changePercent1d >= 0} width={140} height={36} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
