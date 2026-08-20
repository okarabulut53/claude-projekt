import { CoinsIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface FundamentalsRow {
  label: string;
  value: string;
  note: string;
}

export interface FundamentalsAnalysis {
  type: "fundamentals_analysis";
  symbol: string;
  sector?: string;
  rows: FundamentalsRow[];
  growthOutlook?: string;
  summary: string;
}

export function parseFundamentalsAnalysis(content: string): FundamentalsAnalysis | null {
  const parsed = parseStructuredMessage(content) as Partial<FundamentalsAnalysis> | null;
  if (parsed && parsed.type === "fundamentals_analysis" && typeof parsed.symbol === "string" && Array.isArray(parsed.rows)) {
    return parsed as FundamentalsAnalysis;
  }
  return null;
}

export function FundamentalsCard({ analysis }: { analysis: FundamentalsAnalysis }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <CoinsIcon className="h-3.5 w-3.5" />
        </span>
        Fundamentaldaten · {analysis.symbol}
        {analysis.sector && <span className="font-normal text-foreground/50">({analysis.sector})</span>}
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-brand-surface text-[10px] uppercase tracking-wide text-foreground/50">
              <th className="px-2.5 py-1.5 text-left font-semibold">Kennzahl</th>
              <th className="px-2.5 py-1.5 text-right font-semibold">Wert</th>
              <th className="px-2.5 py-1.5 text-left font-semibold">Einordnung</th>
            </tr>
          </thead>
          <tbody>
            {analysis.rows.map((row) => (
              <tr key={row.label} className="border-t border-brand-border align-top">
                <td className="px-2.5 py-1.5 font-medium text-foreground">{row.label}</td>
                <td className="whitespace-nowrap px-2.5 py-1.5 text-right text-foreground/70">{row.value}</td>
                <td className="px-2.5 py-1.5 text-foreground/60">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {analysis.growthOutlook && (
        <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{analysis.growthOutlook}</div>
      )}

      <p className="mt-3 text-xs text-foreground/60">{analysis.summary}</p>
    </div>
  );
}
