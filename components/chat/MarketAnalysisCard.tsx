import { ChartLineIcon, GaugeScoreIcon, ShieldCheckIcon } from "@/components/icons/Icons";

export interface MarketAnalysis {
  type: "market_analysis";
  symbol: string;
  trend: string;
  supportResistance: string;
  riskAssessment: string;
  summary: string;
}

export function parseMarketAnalysis(content: string): MarketAnalysis | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === "market_analysis" && typeof parsed.symbol === "string") {
      return parsed as MarketAnalysis;
    }
    return null;
  } catch {
    return null;
  }
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
      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{analysis.summary}</div>
    </div>
  );
}
