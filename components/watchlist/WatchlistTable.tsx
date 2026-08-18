"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Instrument, InvestmentOpportunity, WatchlistItem } from "@/lib/types";
import { removeFromWatchlist } from "@/lib/actions/watchlist";
import { Card } from "@/components/ui/Card";
import { ChangeBadge, DataSourceBadge, RiskBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

export interface WatchlistRow {
  item: WatchlistItem;
  instrument: Instrument | undefined;
  opportunity: InvestmentOpportunity | undefined;
}

export function WatchlistTable({ rows }: { rows: WatchlistRow[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(itemId: string) {
    setRemovingId(itemId);
    try {
      await removeFromWatchlist(itemId);
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <Card className="text-sm text-foreground/60">
        Deine Watchlist ist noch leer. Füge oben ein Symbol hinzu, um Kurse und AI-Einschätzungen im Blick zu
        behalten.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-brand-border p-0">
      {rows.map(({ item, instrument, opportunity }) => (
        <div key={item.id} className="flex items-center justify-between gap-4 px-6 py-4">
          <Link href={`/instrument/${item.symbol}`} className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{instrument?.name ?? item.symbol}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-foreground/50">
              <span>
                {item.symbol} · {item.assetClass.toUpperCase()}
              </span>
              {instrument && <DataSourceBadge source={instrument.source} />}
              {opportunity && <RiskBadge level={opportunity.riskLevel} />}
            </div>
          </Link>
          {instrument && (
            <div className="text-right">
              <div className="text-sm font-semibold text-foreground">
                {formatCurrency(instrument.price, instrument.currency)}
              </div>
              <ChangeBadge value={instrument.changePercent1d} />
            </div>
          )}
          <button
            type="button"
            onClick={() => handleRemove(item.id)}
            disabled={removingId === item.id}
            className="rounded-full border border-brand-border px-3 py-1.5 text-xs font-medium text-foreground/60 hover:border-risk-high hover:text-risk-high disabled:opacity-50"
          >
            Entfernen
          </button>
        </div>
      ))}
    </Card>
  );
}
