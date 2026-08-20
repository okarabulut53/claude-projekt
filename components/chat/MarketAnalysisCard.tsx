import { ChartLineIcon, GaugeScoreIcon, ShieldCheckIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface MarketAnalysis {
  type: "market_analysis";
  symbol: string;
  trend: string;
  supportResistance: string;
  riskAssessment: string;
  bullCase: string;
  baseCase: string;
  bearCase: string;
  summary: string;
}

export function parseMarketAnalysis(content: string): MarketAnalysis | null {
  const parsed = parseStructuredMessage(content) as Partial<MarketAnalysis> | null;
  if (parsed && parsed.type === "market_analysis" && typeof parsed.symbol === "string") {
    return parsed as MarketAnalysis;
  }
  return null;
}

function Section({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
        {icon}
      </span>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{label}</div>
        <p className="mt-0.5 text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    </div>
  );
}

function ScenarioRow({ label, text, tone }: { label: string; text: string; tone: "bull" | "base" | "bear" }) {
  const toneClasses = {
    bull: "border-risk-low/30 bg-risk-low-bg text-risk-low",
    base: "border-brand-border bg-brand-surface text-foreground/70",
    bear: "border-risk-high/30 bg-risk-high-bg text-risk-high",
  }[tone];
  return (
    <div className={`rounded-lg border p-2.5 ${toneClasses}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">{label}</div>
      <p className="mt-0.5 text-xs leading-relaxed text-foreground/80">{text}</p>
    </div>
  );
}

export function MarketAnalysisCard({ analysis }: { analysis: MarketAnalysis }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-foreground">Markteinschätzung · {analysis.symbol}</div>
      <div className="space-y-3">
        <Section icon={<ChartLineIcon className="h-3.5 w-3.5" />} label="Trend" text={analysis.trend} />
        <Section
          icon={<GaugeScoreIcon className="h-3.5 w-3.5" />}
          label="Unterstützung / Widerstand"
          text={analysis.supportResistance}
        />
        <Section
          icon={<ShieldCheckIcon className="h-3.5 w-3.5" />}
          label="Risiko-Einschätzung"
          text={analysis.riskAssessment}
        />
      </div>

      {(analysis.bullCase || analysis.baseCase || analysis.bearCase) && (
        <div className="mt-3 space-y-1.5">
          {analysis.bullCase && <ScenarioRow label="Bull Case" text={analysis.bullCase} tone="bull" />}
          {analysis.baseCase && <ScenarioRow label="Base Case" text={analysis.baseCase} tone="base" />}
          {analysis.bearCase && <ScenarioRow label="Bear Case" text={analysis.bearCase} tone="bear" />}
        </div>
      )}

      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{analysis.summary}</div>
    </div>
  );
}
