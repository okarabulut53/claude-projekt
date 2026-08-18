import { MarketIndex } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ChangeBadge, DataSourceBadge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatNumber } from "@/lib/format";

export function MarketOverview({ indices }: { indices: MarketIndex[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Marktüberblick</h2>
        <DataSourceBadge source="simulated" />
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        Echtzeit-Indexstände sind bei Finnhub/Twelve Data auch mit API-Key kostenpflichtig — Einzelwerte
        (Aktien, Krypto) oben laufen live, Indizes hier sind Simulationsdaten.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {indices.map((index) => (
          <div key={index.symbol} className="rounded-xl border border-brand-border p-4">
            <div className="text-xs font-medium text-foreground/50">{index.name}</div>
            <div className="mt-1 text-lg font-bold text-foreground">
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
