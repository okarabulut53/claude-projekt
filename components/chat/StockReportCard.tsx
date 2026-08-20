import { Sparkline } from "@/components/charts/Sparkline";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { parseStructuredMessage } from "./structuredMessage";

export interface StockReportPerformanceWindow {
  window: string;
  changePercent?: number;
  unavailableReason?: string;
}

export interface StockReportHorizon {
  label: string;
  signal: string;
  note: string;
}

export interface StockReportMarginRow {
  fiscalYear: string;
  revenue: number;
  grossMarginPct?: number;
  operatingMarginPct?: number;
  netMarginPct?: number;
}

export interface StockReport {
  type: "stock_report";
  symbol: string;
  intro: string;
  keyMetrics: { price: string; marketCap: string; peRatio: string; pegRatio: string; beta: string; rsi: string };
  performance: StockReportPerformanceWindow[];
  technicalHorizons: StockReportHorizon[];
  divergenceNote?: string;
  fundamentalsCoverageNote?: string;
  margins?: StockReportMarginRow[];
  marginTrendInsight?: string;
  balanceSheetCheck?: { currentRatio?: string; returnOnEquityPct?: string; freeCashFlowYieldPct?: string; debtToEquity?: string; cashPosition?: string };
  lastEarnings?: string;
  nextEarningsDate?: string;
  consensusRevisionTrend?: string;
  news?: { title: string; source: string; relevance: string }[];
  analystConsensus?: string;
  bullPoints: string[];
  bearPoints: string[];
  summary: string;
}

export function parseStockReport(content: string): StockReport | null {
  const parsed = parseStructuredMessage(content) as Partial<StockReport> | null;
  if (parsed && parsed.type === "stock_report" && typeof parsed.symbol === "string") {
    return parsed as StockReport;
  }
  return null;
}

function signalClass(signal: string): string {
  if (signal === "bullisch") return "bg-risk-low-bg text-risk-low";
  if (signal === "bärisch") return "bg-risk-high-bg text-risk-high";
  if (signal === "neutral") return "bg-brand-surface text-foreground/60";
  return "bg-brand-surface text-foreground/40";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{children}</div>;
}

export function StockReportCard({ report }: { report: StockReport }) {
  const marginSeries = (report.margins ?? [])
    .filter((m) => typeof m.netMarginPct === "number")
    .map((m) => ({ date: `${m.fiscalYear}-01-01`, price: m.netMarginPct as number }));

  return (
    <div className="max-w-[95%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-1 text-xs font-semibold text-foreground">Analysebericht · {report.symbol}</div>
      <p className="mb-3 text-sm text-foreground/80">{report.intro}</p>

      <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-brand-surface p-3 text-xs sm:grid-cols-6">
        {(
          [
            ["Kurs", report.keyMetrics.price],
            ["Marktkap.", report.keyMetrics.marketCap],
            ["KGV", report.keyMetrics.peRatio],
            ["PEG", report.keyMetrics.pegRatio],
            ["Beta", report.keyMetrics.beta],
            ["RSI", report.keyMetrics.rsi],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <div className="text-foreground/40">{label}</div>
            <div className="font-medium text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <div className="mb-3">
        <SectionLabel>Performance</SectionLabel>
        <div className="grid grid-cols-5 gap-2 text-xs">
          {report.performance.map((p) => (
            <div key={p.window} className="rounded-lg bg-brand-surface p-2 text-center">
              <div className="text-foreground/40">{p.window}</div>
              <div className={`font-medium ${typeof p.changePercent === "number" && p.changePercent < 0 ? "text-risk-high" : "text-risk-low"}`}>
                {typeof p.changePercent === "number" ? `${p.changePercent >= 0 ? "+" : ""}${p.changePercent.toFixed(1)} %` : "n. v."}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <SectionLabel>Technische Signale über mehrere Zeitebenen</SectionLabel>
        <div className="space-y-1">
          {report.technicalHorizons.map((h) => (
            <div key={h.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground/70">{h.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${signalClass(h.signal)}`}>{h.signal}</span>
            </div>
          ))}
        </div>
        {report.divergenceNote && (
          <p className="mt-1.5 rounded-lg bg-risk-medium-bg p-2 text-[11px] text-risk-medium">{report.divergenceNote}</p>
        )}
      </div>

      {report.margins && report.margins.length > 0 && (
        <div className="mb-3">
          <SectionLabel>Margen-/Umsatzentwicklung</SectionLabel>
          {marginSeries.length >= 2 && (
            <div className="mb-2">
              <Sparkline data={marginSeries} positive={marginSeries[marginSeries.length - 1].price >= marginSeries[0].price} width={260} height={40} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-xs">
              <thead>
                <tr className="text-left text-foreground/50">
                  <th className="pb-1 pr-2 font-medium">Jahr</th>
                  <th className="pb-1 pr-2 font-medium">Umsatz</th>
                  <th className="pb-1 pr-2 font-medium">Brutto</th>
                  <th className="pb-1 pr-2 font-medium">Operativ</th>
                  <th className="pb-1 pr-2 font-medium">Netto</th>
                </tr>
              </thead>
              <tbody className="text-foreground/80">
                {report.margins.map((m) => (
                  <tr key={m.fiscalYear}>
                    <td className="py-0.5 pr-2">{m.fiscalYear}</td>
                    <td className="py-0.5 pr-2">{(m.revenue / 1_000_000_000).toFixed(1)} Mrd.</td>
                    <td className="py-0.5 pr-2">{typeof m.grossMarginPct === "number" ? `${m.grossMarginPct.toFixed(1)} %` : "n. v."}</td>
                    <td className="py-0.5 pr-2">{typeof m.operatingMarginPct === "number" ? `${m.operatingMarginPct.toFixed(1)} %` : "n. v."}</td>
                    <td className="py-0.5 pr-2">{typeof m.netMarginPct === "number" ? `${m.netMarginPct.toFixed(1)} %` : "n. v."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.marginTrendInsight && <p className="mt-1.5 text-xs text-foreground/60">{report.marginTrendInsight}</p>}
        </div>
      )}

      {report.balanceSheetCheck && (
        <div className="mb-3">
          <SectionLabel>Bilanz-Kurzcheck</SectionLabel>
          <ul className="space-y-0.5 text-xs text-foreground/70">
            <li>Current Ratio: {report.balanceSheetCheck.currentRatio ?? "nicht verfügbar"}</li>
            <li>Eigenkapitalrendite: {report.balanceSheetCheck.returnOnEquityPct ?? "nicht verfügbar"}</li>
            <li>FCF-Rendite: {report.balanceSheetCheck.freeCashFlowYieldPct ?? "nicht verfügbar"}</li>
            <li>Verschuldungsgrad: {report.balanceSheetCheck.debtToEquity ?? "nicht verfügbar"}</li>
            <li>Cash-Position: {report.balanceSheetCheck.cashPosition ?? "nicht verfügbar"}</li>
          </ul>
        </div>
      )}

      <div className="mb-3">
        <SectionLabel>Earnings</SectionLabel>
        <p className="text-xs text-foreground/70">Letztes Ergebnis: {report.lastEarnings ?? "nicht verfügbar"}</p>
        <p className="text-xs text-foreground/70">Nächster Termin: {report.nextEarningsDate ?? "nicht verfügbar"}</p>
        <p className="text-xs text-foreground/70">Konsens-Revisionstrend: {report.consensusRevisionTrend ?? "nicht verfügbar"}</p>
      </div>

      {report.news && report.news.length > 0 && (
        <div className="mb-3">
          <SectionLabel>Relevante News</SectionLabel>
          <ul className="space-y-1">
            {report.news.map((n, i) => (
              <li key={i} className="text-xs text-foreground/70">
                <span className="font-medium text-foreground">{n.title}</span> ({n.source}) — {n.relevance}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-3">
        <SectionLabel>Analysten-Konsens</SectionLabel>
        <p className="text-xs text-foreground/70">{report.analystConsensus ?? "nicht verfügbar"}</p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-risk-low/30 bg-risk-low-bg p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-risk-low">🐂 Bull Case</div>
          <ul className="space-y-1">
            {report.bullPoints.map((p, i) => (
              <li key={i} className="text-xs leading-relaxed text-foreground/80">
                • {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-risk-high/30 bg-risk-high-bg p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-risk-high">🐻 Bear Case</div>
          <ul className="space-y-1">
            {report.bearPoints.map((p, i) => (
              <li key={i} className="text-xs leading-relaxed text-foreground/80">
                • {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg bg-brand-surface p-3 text-sm text-foreground/80">{report.summary}</div>
      <DisclaimerNote className="mt-3" />
    </div>
  );
}
