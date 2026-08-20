import { BookmarkIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface WatchlistOverviewItem {
  symbol: string;
  name: string;
  price: string;
  changePercent1d: string;
  changePercent30d: string;
  volatility: string;
  dataSource: "live" | "simulated";
}

export interface WatchlistOverview {
  type: "watchlist_overview";
  items: WatchlistOverviewItem[];
  insight: string;
  dataGaps?: string;
}

export function parseWatchlistOverview(content: string): WatchlistOverview | null {
  const parsed = parseStructuredMessage(content) as Partial<WatchlistOverview> | null;
  if (parsed && parsed.type === "watchlist_overview" && Array.isArray(parsed.items)) {
    return parsed as WatchlistOverview;
  }
  return null;
}

function isNegative(change: string) {
  return change.trim().startsWith("-");
}

export function WatchlistOverviewCard({ overview }: { overview: WatchlistOverview }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <BookmarkIcon className="h-3.5 w-3.5" />
        </span>
        Watchlist-Übersicht
      </div>

      <div className="overflow-x-auto rounded-lg border border-brand-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-surface text-[10px] uppercase tracking-wide text-foreground/50">
              <th className="px-2.5 py-1.5 text-left font-semibold">Symbol</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Kurs</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">1T</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">30T</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Volatilität</th>
            </tr>
          </thead>
          <tbody>
            {overview.items.map((item) => (
              <tr key={item.symbol} className="border-t border-brand-border">
                <td className="px-2.5 py-1.5">
                  <div className="font-medium text-foreground">{item.symbol}</div>
                  <div className="text-[10px] text-foreground/40">
                    {item.name}
                    {item.dataSource === "simulated" && " · Simulationsdaten"}
                  </div>
                </td>
                <td className="px-2.5 py-1.5 text-right text-foreground/70">{item.price}</td>
                <td className={`px-2.5 py-1.5 text-right font-semibold ${isNegative(item.changePercent1d) ? "text-risk-high" : "text-risk-low"}`}>
                  {item.changePercent1d}
                </td>
                <td className={`px-2.5 py-1.5 text-right font-semibold ${isNegative(item.changePercent30d) ? "text-risk-high" : "text-risk-low"}`}>
                  {item.changePercent30d}
                </td>
                <td className="px-2.5 py-1.5 text-right text-foreground/70">{item.volatility}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{overview.insight}</div>

      {overview.dataGaps && (
        <div className="mt-2 rounded-lg bg-brand-surface p-2.5 text-xs text-foreground/50">{overview.dataGaps}</div>
      )}
    </div>
  );
}
