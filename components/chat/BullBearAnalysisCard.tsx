import { parseStructuredMessage } from "./structuredMessage";

export interface BullBearAnalysis {
  type: "bull_bear_analysis";
  symbol: string;
  bullPoints: string[];
  bearPoints: string[];
  conclusion: string;
}

export function parseBullBearAnalysis(content: string): BullBearAnalysis | null {
  const parsed = parseStructuredMessage(content) as Partial<BullBearAnalysis> | null;
  if (parsed && parsed.type === "bull_bear_analysis" && typeof parsed.symbol === "string") {
    return parsed as BullBearAnalysis;
  }
  return null;
}

function ArgumentColumn({ label, points, tone }: { label: string; points: string[]; tone: "bull" | "bear" }) {
  const toneClasses =
    tone === "bull" ? "border-risk-low/30 bg-risk-low-bg text-risk-low" : "border-risk-high/30 bg-risk-high-bg text-risk-high";
  return (
    <div className={`rounded-lg border p-2.5 ${toneClasses}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <ul className="mt-1.5 space-y-1.5">
        {points.map((point, i) => (
          <li key={i} className="text-xs leading-relaxed text-foreground/80">
            • {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BullBearAnalysisCard({ analysis }: { analysis: BullBearAnalysis }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-foreground">Bullen vs. Bären · {analysis.symbol}</div>
      <div className="grid grid-cols-2 gap-2">
        <ArgumentColumn label="Bullish" points={analysis.bullPoints} tone="bull" />
        <ArgumentColumn label="Bearish" points={analysis.bearPoints} tone="bear" />
      </div>
      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{analysis.conclusion}</div>
    </div>
  );
}
