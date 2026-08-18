import { RiskProfile } from "@/lib/types";

const riskLabels: Record<RiskProfile, string> = {
  low: "Niedriges Risiko",
  medium: "Mittleres Risiko",
  high: "Hohes Risiko",
};

const riskClasses: Record<RiskProfile, string> = {
  low: "bg-risk-low-bg text-risk-low",
  medium: "bg-risk-medium-bg text-risk-medium",
  high: "bg-risk-high-bg text-risk-high",
};

export function RiskBadge({ level }: { level: RiskProfile }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${riskClasses[level]}`}
    >
      {riskLabels[level]}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-risk-low" : score >= 65 ? "text-risk-medium" : "text-risk-high";
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 py-1">
      <span className="text-xs font-medium text-foreground/60">AI Score</span>
      <span className={`text-sm font-bold ${color}`}>{score}/100</span>
    </div>
  );
}

export function ChangeBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span className={`text-sm font-semibold ${positive ? "text-risk-low" : "text-risk-high"}`}>
      {positive ? "+" : ""}
      {value.toFixed(1)} %
    </span>
  );
}

export function DataSourceBadge({ source }: { source: "live" | "simulated" }) {
  if (source === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-low-bg px-2.5 py-1 text-[11px] font-semibold text-risk-low">
        <span className="h-1.5 w-1.5 rounded-full bg-risk-low" />
        Live-Kurs
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-2.5 py-1 text-[11px] font-semibold text-foreground/50">
      <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
      Simulationsdaten
    </span>
  );
}
