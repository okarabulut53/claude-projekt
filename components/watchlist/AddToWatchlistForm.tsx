"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchInstrumentQuote } from "@/lib/actions/instrument";
import { addToWatchlist } from "@/lib/actions/watchlist";

export function AddToWatchlistForm() {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = symbol.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const instrument = await fetchInstrumentQuote(trimmed);
      if (!instrument) {
        setError(`Kein Instrument mit Symbol "${trimmed}" gefunden.`);
        return;
      }
      await addToWatchlist(instrument.symbol, instrument.assetClass);
      setSymbol("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        placeholder="Symbol hinzufügen, z. B. NVDA"
        className="flex-1 rounded-full border border-brand-border px-4 py-2 text-sm outline-none focus:border-brand-teal"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-brand-teal px-5 py-2 text-sm font-semibold text-white hover:bg-brand-teal/90 disabled:opacity-50"
      >
        Hinzufügen
      </button>
      {error && <span className="self-center text-xs text-risk-high">{error}</span>}
    </form>
  );
}
