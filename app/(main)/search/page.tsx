import Link from "next/link";
import { searchInstruments } from "@/lib/mock/instruments";
import { Card } from "@/components/ui/Card";
import { ChangeBadge, DataSourceBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = await searchInstruments(query);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Suche</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {query ? (
            <>
              {results.length} Ergebnis{results.length === 1 ? "" : "se"} für &quot;{query}&quot;
            </>
          ) : (
            "Suche nach Aktien, ETFs, Kryptowährungen oder ISIN."
          )}
        </p>
      </div>

      {results.length > 0 && (
        <Card className="divide-y divide-brand-border p-0">
          {results.map((instrument) => (
            <Link
              key={instrument.symbol}
              href={`/instrument/${instrument.symbol}`}
              className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-surface-hover"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">{instrument.name}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-foreground/50">
                  <span>
                    {instrument.symbol} · {instrument.assetClass.toUpperCase()}
                  </span>
                  <DataSourceBadge source={instrument.source} />
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">
                  {formatCurrency(instrument.price, instrument.currency)}
                </div>
                <ChangeBadge value={instrument.changePercent1d} />
              </div>
            </Link>
          ))}
        </Card>
      )}

      {query && results.length === 0 && (
        <Card className="text-sm text-foreground/60">
          Keine Treffer für &quot;{query}&quot;. Diese erste Version deckt eine ausgewählte
          Instrumenten-Liste ab, echte Marktdaten-Anbindung folgt später.
        </Card>
      )}
    </div>
  );
}
