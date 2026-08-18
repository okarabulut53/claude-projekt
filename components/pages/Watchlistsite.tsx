import { requireAppUser } from "@/lib/current-user";
import { getWatchlist } from "@/lib/db";
import { getInstrument } from "@/lib/mock/instruments";
import { getOpportunityForSymbol } from "@/lib/mock/opportunities";
import { AddToWatchlistForm } from "@/components/watchlist/AddToWatchlistForm";
import { WatchlistTable, WatchlistRow } from "@/components/watchlist/WatchlistTable";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";

export async function Watchlistsite() {
  const appUser = await requireAppUser();
  const items = await getWatchlist(appUser.id);

  const rows: WatchlistRow[] = await Promise.all(
    items.map(async (item) => ({
      item,
      instrument: await getInstrument(item.symbol),
      opportunity: await getOpportunityForSymbol(item.symbol),
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Watchlisten</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Behalte Kurse und AI-Einschätzungen deiner beobachteten Instrumente im Blick.
        </p>
      </div>

      <AddToWatchlistForm />

      <WatchlistTable rows={rows} />

      <DisclaimerNote />
    </div>
  );
}
