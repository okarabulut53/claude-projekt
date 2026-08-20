import { ChartLineIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface MarketOverviewIndex {
  symbol: string;
  name: string;
  value: string;
  changePercent1d: string;
}

export interface MarketOverview {
  type: "market_overview";
  indices: MarketOverviewIndex[];
  insight: string;
  unavailable?: string[];
}

export function parseMarketOverview(content: string): MarketOverview | null {
  const parsed = parseStructuredMessage(content) as Partial<MarketOverview> | null;
  if (parsed && parsed.type === "market_overview" && Array.isArray(parsed.indices)) {
    return parsed as MarketOverview;
  }
  return null;
}

function isNegative(change: string) {
  return change.trim().startsWith("-");
}

export function MarketOverviewCard({ overview }: { overview: MarketOverview }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <ChartLineIcon className="h-3.5 w-3.5" />
        </span>
        Marktübersicht
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-surface text-[10px] uppercase tracking-wide text-foreground/50">
              <th className="px-2.5 py-1.5 text-left font-semibold">Index</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Stand</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Tag</th>
            </tr>
          </thead>
          <tbody>
            {overview.indices.map((index) => (
              <tr key={index.symbol} className="border-t border-brand-border">
                <td className="px-2.5 py-1.5 font-medium text-foreground">{index.name}</td>
                <td className="px-2.5 py-1.5 text-right text-foreground/70">{index.value}</td>
                <td className={`px-2.5 py-1.5 text-right font-semibold ${isNegative(index.changePercent1d) ? "text-risk-high" : "text-risk-low"}`}>
                  {index.changePercent1d}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{overview.insight}</div>

      {overview.unavailable && overview.unavailable.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {overview.unavailable.map((item) => (
            <span key={item} className="rounded-full bg-brand-surface px-2 py-0.5 text-[10px] font-medium text-foreground/50">
              {item}: nicht verfügbar
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
