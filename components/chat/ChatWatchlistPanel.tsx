"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WatchlistItem, Instrument } from "@/lib/types";
import { fetchInstrumentQuote } from "@/lib/actions/instrument";
import { ChangeBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

export function ChatWatchlistPanel({
  items,
  onSelectSymbol,
}: {
  items: WatchlistItem[];
  onSelectSymbol: (symbol: string) => void;
}) {
  const [quotes, setQuotes] = useState<Record<string, Instrument | null>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(items.map((item) => fetchInstrumentQuote(item.symbol))).then((results) => {
      if (cancelled) return;
      const map: Record<string, Instrument | null> = {};
      items.forEach((item, i) => (map[item.symbol] = results[i]));
      setQuotes(map);
    });
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Watchlist</span>
        <Link href="/watchlist" className="text-xs font-medium text-brand-teal hover:underline">
          Alle anzeigen
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <p className="p-4 text-xs text-foreground/50">
            Noch keine Watchlist-Einträge. Füge Instrumente über die Watchlisten-Seite hinzu.
          </p>
        )}
        {items.map((item) => {
          const quote = quotes[item.symbol];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSymbol(item.symbol)}
              className="flex w-full items-center justify-between gap-2 border-b border-brand-border px-4 py-3 text-left hover:bg-surface-hover"
            >
              <div>
                <div className="text-sm font-semibold text-foreground">{item.symbol}</div>
                <div className="text-xs text-foreground/50">{item.assetClass.toUpperCase()}</div>
              </div>
              {quote ? (
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    {formatCurrency(quote.price, quote.currency)}
                  </div>
                  <ChangeBadge value={quote.changePercent1d} />
                </div>
              ) : (
                <span className="text-xs text-foreground/40">…</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
