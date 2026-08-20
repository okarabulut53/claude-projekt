import { parseStructuredMessage } from "./structuredMessage";

export interface SwotAnalysis {
  type: "swot_analysis";
  symbol: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  summary: string;
}

export function parseSwotAnalysis(content: string): SwotAnalysis | null {
  const parsed = parseStructuredMessage(content) as Partial<SwotAnalysis> | null;
  if (parsed && parsed.type === "swot_analysis" && typeof parsed.symbol === "string") {
    return parsed as SwotAnalysis;
  }
  return null;
}

function Quadrant({ label, points, tone }: { label: string; points: string[]; tone: "low" | "medium" | "teal" | "high" }) {
  const toneClasses = {
    low: "border-risk-low/30 bg-risk-low-bg text-risk-low",
    medium: "border-risk-medium/30 bg-risk-medium-bg text-risk-medium",
    teal: "border-brand-teal/30 bg-brand-teal-light text-brand-teal",
    high: "border-risk-high/30 bg-risk-high-bg text-risk-high",
  }[tone];
  return (
    <div className={`rounded-lg border p-2.5 ${toneClasses}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <ul className="mt-1.5 space-y-1">
        {points.map((point, i) => (
          <li key={i} className="text-xs leading-relaxed text-foreground/80">
            • {point}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SwotAnalysisCard({ analysis }: { analysis: SwotAnalysis }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-foreground">SWOT-Analyse · {analysis.symbol}</div>
      <div className="grid grid-cols-2 gap-2">
        <Quadrant label="Stärken" points={analysis.strengths} tone="low" />
        <Quadrant label="Schwächen" points={analysis.weaknesses} tone="medium" />
        <Quadrant label="Chancen" points={analysis.opportunities} tone="teal" />
        <Quadrant label="Risiken" points={analysis.risks} tone="high" />
      </div>
      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{analysis.summary}</div>
    </div>
  );
}
