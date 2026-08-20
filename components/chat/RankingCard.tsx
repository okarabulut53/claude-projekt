import { RocketIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface RankingRow {
  rank: number;
  symbol: string;
  name: string;
  assetClass: string;
  compositeScore: number;
  driver: string;
}

export interface Ranking {
  type: "ranking";
  period: string;
  candidatesTotal: number;
  scopeNote: string;
  rows: RankingRow[];
}

export function parseRanking(content: string): Ranking | null {
  const parsed = parseStructuredMessage(content) as Partial<Ranking> | null;
  if (parsed && parsed.type === "ranking" && Array.isArray(parsed.rows)) {
    return parsed as Ranking;
  }
  return null;
}

export function RankingCard({ ranking }: { ranking: Ranking }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <RocketIcon className="h-3.5 w-3.5" />
        </span>
        Score-Ranking · {ranking.period}
      </div>

      <div className="space-y-2">
        {ranking.rows.map((row) => (
          <div key={row.symbol} className="flex items-center gap-3 rounded-lg bg-brand-surface p-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
              {row.rank}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold text-foreground">
                  {row.symbol} <span className="font-normal text-foreground/50">· {row.name}</span>
                </span>
                <span className="shrink-0 text-sm font-bold text-brand-teal">{row.compositeScore}/100</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-foreground/60">{row.driver}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-brand-surface p-2.5 text-xs text-foreground/60">
        {ranking.scopeNote} ({ranking.candidatesTotal} Kandidaten analysiert)
      </div>
    </div>
  );
}
