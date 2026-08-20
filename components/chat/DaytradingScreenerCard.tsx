import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { parseStructuredMessage } from "./structuredMessage";

export interface DaytradingCandidate {
  symbol: string;
  name: string;
  price: string;
  changePercent1d: string;
  rsi: string;
  technicalSignal: "bullisch" | "neutral" | "bärisch" | "nicht verfügbar";
  beta: string;
  strengths: string[];
  warnings: string[];
  pivotLevels?: { pivot: number; r1: number; s1: number };
}

export interface DaytradingMarketTiming {
  exchange: string;
  status: string;
  minutesToNextChange?: number;
  nextChangeLabel?: string;
  dataFreshnessNote: string;
}

export interface DaytradingScreener {
  type: "daytrading_screener";
  beginnerWarning?: string;
  marketTiming: DaytradingMarketTiming;
  screenerScopeNote: string;
  candidates: DaytradingCandidate[];
}

export function parseDaytradingScreener(content: string): DaytradingScreener | null {
  const parsed = parseStructuredMessage(content) as Partial<DaytradingScreener> | null;
  if (parsed && parsed.type === "daytrading_screener" && Array.isArray(parsed.candidates)) {
    return parsed as DaytradingScreener;
  }
  return null;
}

const signalClasses: Record<DaytradingCandidate["technicalSignal"], string> = {
  bullisch: "bg-risk-low-bg text-risk-low",
  bärisch: "bg-risk-high-bg text-risk-high",
  neutral: "bg-brand-surface text-foreground/60",
  "nicht verfügbar": "bg-brand-surface text-foreground/40",
};

/** Mandatory, always rendered, never model-supplied — see the tool's doc comment in tools.ts for
 *  why this list can't be a field the model could omit or shorten. */
const RISK_CHECKLIST = [
  "Markteröffnung erst einige Minuten beobachten, nicht sofort handeln.",
  "Volumenbestätigung prüfen, bevor eine Position eröffnet wird.",
  "Stop-Loss IMMER setzen — orientiere dich z. B. an den Pivot-Support-/Widerstandsniveaus unten.",
  "Nie mehr als 1-2 % des Kapitals pro Einzeltrade riskieren.",
];

function RiskChecklist() {
  return (
    <div className="mb-3 rounded-lg border border-risk-medium/30 bg-risk-medium-bg p-3">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-risk-medium">Risikomanagement-Checkliste</div>
      <ul className="space-y-1">
        {RISK_CHECKLIST.map((item, i) => (
          <li key={i} className="text-xs leading-relaxed text-foreground/80">
            ☐ {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandidateSection({ candidate }: { candidate: DaytradingCandidate }) {
  return (
    <div className="rounded-xl border border-brand-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold text-foreground">
          {candidate.name} <span className="font-normal text-foreground/50">({candidate.symbol})</span>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${signalClasses[candidate.technicalSignal]}`}>
          {candidate.technicalSignal}
        </span>
      </div>
      <div className="mb-2 grid grid-cols-4 gap-2 text-xs text-foreground/70">
        <div>
          <div className="text-foreground/40">Kurs</div>
          {candidate.price}
        </div>
        <div>
          <div className="text-foreground/40">Tagesperf.</div>
          {candidate.changePercent1d}
        </div>
        <div>
          <div className="text-foreground/40">RSI</div>
          {candidate.rsi}
        </div>
        <div>
          <div className="text-foreground/40">Beta</div>
          {candidate.beta}
        </div>
      </div>
      {candidate.strengths.length > 0 && (
        <div className="mb-1.5">
          {candidate.strengths.map((s, i) => (
            <p key={i} className="text-xs leading-relaxed text-risk-low">
              + {s}
            </p>
          ))}
        </div>
      )}
      {candidate.warnings.length > 0 && (
        <div className="mb-1.5">
          {candidate.warnings.map((w, i) => (
            <p key={i} className="text-xs leading-relaxed text-risk-high">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}
      {candidate.pivotLevels && (
        <div className="mt-1.5 rounded-lg bg-brand-surface p-2 text-[11px] text-foreground/60">
          Key Levels: S1 {candidate.pivotLevels.s1.toFixed(2)} · Pivot {candidate.pivotLevels.pivot.toFixed(2)} · R1{" "}
          {candidate.pivotLevels.r1.toFixed(2)}
        </div>
      )}
    </div>
  );
}

export function DaytradingScreenerCard({ screener }: { screener: DaytradingScreener }) {
  return (
    <div className="max-w-[95%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold text-foreground">Daytrading-Kandidaten-Screener</div>

      <div className="mb-3 rounded-lg border border-brand-border bg-brand-surface p-2.5 text-xs text-foreground/70">
        <span className="font-semibold">Markt-Status ({screener.marketTiming.exchange}):</span> {screener.marketTiming.status}
        {screener.marketTiming.nextChangeLabel ? ` · ${screener.marketTiming.nextChangeLabel}` : ""}
        <br />
        {screener.marketTiming.dataFreshnessNote}
      </div>

      {screener.beginnerWarning && (
        <div className="mb-3 rounded-lg border border-risk-high/40 bg-risk-high-bg p-2.5 text-xs text-risk-high">{screener.beginnerWarning}</div>
      )}

      <p className="mb-3 text-[11px] text-foreground/40">{screener.screenerScopeNote}</p>

      <RiskChecklist />

      <div className="space-y-3">
        {screener.candidates.map((candidate) => (
          <CandidateSection key={candidate.symbol} candidate={candidate} />
        ))}
      </div>

      <DisclaimerNote
        className="mt-3"
        extra="Day-Trading ist mit erheblichem Verlustrisiko verbunden und für die meisten Privatanleger statistisch verlustreich."
      />
    </div>
  );
}
