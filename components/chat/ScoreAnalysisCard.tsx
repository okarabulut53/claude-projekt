import { GaugeScoreIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface ScoreAnalysisIndicator {
  label: string;
  value: string;
  signal: "bullisch" | "neutral" | "bärisch" | "nicht verfügbar";
}

export interface ScoreAnalysisFactor {
  label: string;
  score?: number;
  weightPercent: number;
  note: string;
}

export interface ScoreAnalysis {
  type: "score_analysis";
  symbol: string;
  instrumentType: string;
  technicalIndicators: ScoreAnalysisIndicator[];
  technicalSubscore?: number;
  factors: ScoreAnalysisFactor[];
  overallScore?: number;
  confidence: "niedrig" | "mittel" | "hoch";
  missingDataNote?: string;
}

export function parseScoreAnalysis(content: string): ScoreAnalysis | null {
  const parsed = parseStructuredMessage(content) as Partial<ScoreAnalysis> | null;
  if (parsed && parsed.type === "score_analysis" && typeof parsed.symbol === "string") {
    return parsed as ScoreAnalysis;
  }
  return null;
}

const signalClasses: Record<ScoreAnalysisIndicator["signal"], string> = {
  bullisch: "bg-risk-low-bg text-risk-low",
  bärisch: "bg-risk-high-bg text-risk-high",
  neutral: "bg-brand-surface text-foreground/60",
  "nicht verfügbar": "bg-brand-surface text-foreground/40",
};

function confidenceClasses(confidence: ScoreAnalysis["confidence"]) {
  if (confidence === "hoch") return "bg-risk-low-bg text-risk-low";
  if (confidence === "niedrig") return "bg-risk-high-bg text-risk-high";
  return "bg-brand-surface text-foreground/60";
}

export function ScoreAnalysisCard({ analysis }: { analysis: ScoreAnalysis }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
            <GaugeScoreIcon className="h-3.5 w-3.5" />
          </span>
          Score-Analyse · {analysis.symbol}
          <span className="font-normal text-foreground/50">({analysis.instrumentType})</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceClasses(analysis.confidence)}`}>
          Konfidenz: {analysis.confidence}
        </span>
      </div>

      <div className="mb-3 rounded-lg bg-brand-surface p-3 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">Gesamtscore</div>
        <div className="text-2xl font-bold text-foreground">
          {typeof analysis.overallScore === "number" ? `${analysis.overallScore}/100` : "nicht verfügbar"}
        </div>
      </div>

      {analysis.technicalIndicators.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
            Technische Analyse{typeof analysis.technicalSubscore === "number" ? ` · Unterscore ${analysis.technicalSubscore}/100` : ""}
          </div>
          <div className="space-y-1">
            {analysis.technicalIndicators.map((indicator) => (
              <div key={indicator.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground/70">{indicator.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground/50">{indicator.value}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${signalClasses[indicator.signal]}`}>
                    {indicator.signal}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.factors.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">Gesamtfaktoren</div>
          {analysis.factors.map((factor) => (
            <div key={factor.label} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{factor.label}</span>
                <span className="text-foreground/60">
                  {typeof factor.score === "number" ? `${factor.score}/100` : "n. v."} · {factor.weightPercent.toFixed(0)} %
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-brand-surface">
                <div
                  className="h-1.5 rounded-full bg-brand-teal"
                  style={{ width: `${typeof factor.score === "number" ? factor.score : 0}%` }}
                />
              </div>
              <p className="mt-1 text-foreground/60">{factor.note}</p>
            </div>
          ))}
        </div>
      )}

      {analysis.missingDataNote && (
        <div className="mt-3 rounded-lg bg-brand-surface p-2.5 text-xs text-foreground/60">{analysis.missingDataNote}</div>
      )}
    </div>
  );
}
