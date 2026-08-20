import { ScoreAnalysisCard, ScoreAnalysis } from "./ScoreAnalysisCard";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { parseStructuredMessage } from "./structuredMessage";

export interface IntradayTimeframeRow {
  timeframe: "1m" | "5m" | "15m";
  available: boolean;
  unavailableReason?: string;
  rsi?: number;
  macdHistogram?: number;
  adx?: number;
  stochasticK?: number;
  signal: "bullisch" | "neutral" | "bärisch" | "nicht verfügbar";
}

export interface ShortTermCandidate {
  symbol: string;
  name: string;
  technicalsByTimeframe: IntradayTimeframeRow[];
  scoreAnalysis: ScoreAnalysis;
  pros: string[];
  cons: string[];
}

export interface ShortTermMarketTiming {
  exchange: string;
  status: string;
  minutesToNextChange?: number;
  nextChangeLabel?: string;
}

export interface ShortTermComparison {
  type: "shortterm_comparison";
  marketTiming?: ShortTermMarketTiming;
  candidates: ShortTermCandidate[];
  verdict: string;
}

export function parseShortTermComparison(content: string): ShortTermComparison | null {
  const parsed = parseStructuredMessage(content) as Partial<ShortTermComparison> | null;
  if (parsed && parsed.type === "shortterm_comparison" && Array.isArray(parsed.candidates)) {
    return parsed as ShortTermComparison;
  }
  return null;
}

const signalClasses: Record<IntradayTimeframeRow["signal"], string> = {
  bullisch: "bg-risk-low-bg text-risk-low",
  bärisch: "bg-risk-high-bg text-risk-high",
  neutral: "bg-brand-surface text-foreground/60",
  "nicht verfügbar": "bg-brand-surface text-foreground/40",
};

const TIMEFRAME_LABEL: Record<IntradayTimeframeRow["timeframe"], string> = { "1m": "1 Min", "5m": "5 Min", "15m": "15 Min" };

function isMarketTimingUrgent(timing: ShortTermMarketTiming): boolean {
  if (timing.status === "closed") return true;
  if (timing.status === "open" && typeof timing.minutesToNextChange === "number" && timing.minutesToNextChange < 30) return true;
  return false;
}

function TimeframeTable({ candidate }: { candidate: ShortTermCandidate }) {
  return (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full min-w-[360px] text-xs">
        <thead>
          <tr className="text-left text-foreground/50">
            <th className="pb-1 pr-2 font-medium">Indikator</th>
            {candidate.technicalsByTimeframe.map((tf) => (
              <th key={tf.timeframe} className="pb-1 pr-2 font-medium">
                {TIMEFRAME_LABEL[tf.timeframe]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-foreground/80">
          <tr>
            <td className="py-0.5 pr-2 text-foreground/60">Signal</td>
            {candidate.technicalsByTimeframe.map((tf) => (
              <td key={tf.timeframe} className="py-0.5 pr-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${signalClasses[tf.signal]}`}>{tf.signal}</span>
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-0.5 pr-2 text-foreground/60">RSI</td>
            {candidate.technicalsByTimeframe.map((tf) => (
              <td key={tf.timeframe} className="py-0.5 pr-2">
                {tf.available && typeof tf.rsi === "number" ? tf.rsi.toFixed(1) : "n. v."}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-0.5 pr-2 text-foreground/60">MACD-Hist.</td>
            {candidate.technicalsByTimeframe.map((tf) => (
              <td key={tf.timeframe} className="py-0.5 pr-2">
                {tf.available && typeof tf.macdHistogram === "number" ? tf.macdHistogram.toFixed(2) : "n. v."}
              </td>
            ))}
          </tr>
          <tr>
            <td className="py-0.5 pr-2 text-foreground/60">ADX</td>
            {candidate.technicalsByTimeframe.map((tf) => (
              <td key={tf.timeframe} className="py-0.5 pr-2">
                {tf.available && typeof tf.adx === "number" ? tf.adx.toFixed(1) : "n. v."}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {candidate.technicalsByTimeframe.some((tf) => !tf.available) && (
        <p className="mt-1 text-[11px] text-foreground/40">
          {candidate.technicalsByTimeframe
            .filter((tf) => !tf.available && tf.unavailableReason)
            .map((tf) => tf.unavailableReason)
            .join(" ")}
        </p>
      )}
    </div>
  );
}

function ProConList({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-risk-low/30 bg-risk-low-bg p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-risk-low">Pro</div>
        <ul className="space-y-1">
          {pros.map((p, i) => (
            <li key={i} className="text-xs leading-relaxed text-foreground/80">
              • {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-risk-high/30 bg-risk-high-bg p-2.5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-risk-high">Contra</div>
        <ul className="space-y-1">
          {cons.map((c, i) => (
            <li key={i} className="text-xs leading-relaxed text-foreground/80">
              • {c}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ShortTermComparisonCard({ comparison }: { comparison: ShortTermComparison }) {
  const timing = comparison.marketTiming;
  const urgent = timing ? isMarketTimingUrgent(timing) : false;

  return (
    <div className="max-w-[95%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-foreground">Kurzfrist-Vergleich</div>

      {timing && (
        <div
          className={`mb-3 rounded-lg border p-2.5 text-xs ${
            urgent ? "border-risk-high/40 bg-risk-high-bg text-risk-high" : "border-brand-border bg-brand-surface text-foreground/70"
          }`}
        >
          <span className="font-semibold">Markt-Status ({timing.exchange}):</span> {timing.status}
          {timing.nextChangeLabel ? ` · ${timing.nextChangeLabel}` : ""}
        </div>
      )}

      <div className="space-y-4">
        {comparison.candidates.map((candidate) => (
          <div key={candidate.symbol} className="rounded-xl border border-brand-border p-3">
            <div className="mb-2 text-sm font-semibold text-foreground">
              {candidate.name} <span className="font-normal text-foreground/50">({candidate.symbol})</span>
            </div>
            <TimeframeTable candidate={candidate} />
            <div className="mb-3">
              <ScoreAnalysisCard analysis={candidate.scoreAnalysis} />
            </div>
            <ProConList pros={candidate.pros} cons={candidate.cons} />
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{comparison.verdict}</div>
      <DisclaimerNote className="mt-3" />
    </div>
  );
}
