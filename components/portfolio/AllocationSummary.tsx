import { PortfolioAnalysis, assetClassLabel } from "@/lib/portfolio-analysis";
import { Card } from "@/components/ui/Card";
import { ChangeBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

const barColors = {
  stock: "bg-brand-teal",
  etf: "bg-brand-navy",
  crypto: "bg-risk-medium",
} as const;

export function AllocationSummary({ analysis }: { analysis: PortfolioAnalysis }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <div className="text-xs font-medium text-foreground/50">Gesamtwert</div>
        <div className="mt-1 text-2xl font-bold text-brand-navy">
          {formatCurrency(analysis.totalValue)}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${analysis.gainAbs >= 0 ? "text-risk-low" : "text-risk-high"}`}
          >
            {formatCurrency(analysis.gainAbs)}
          </span>
          <ChangeBadge value={analysis.gainPct} />
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <div className="text-xs font-medium text-foreground/50">Asset Allocation</div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-brand-surface">
          {analysis.allocation.map((a) => (
            <div
              key={a.assetClass}
              className={barColors[a.assetClass]}
              style={{ width: `${a.percent}%` }}
              title={`${assetClassLabel[a.assetClass]}: ${a.percent.toFixed(0)}%`}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {analysis.allocation.map((a) => (
            <div key={a.assetClass} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${barColors[a.assetClass]}`} />
              <span className="text-foreground/70">{assetClassLabel[a.assetClass]}</span>
              <span className="font-medium text-foreground">{a.percent.toFixed(0)} %</span>
            </div>
          ))}
        </div>
        {analysis.concentrationNote && (
          <p className="mt-4 rounded-lg bg-risk-medium-bg px-3 py-2 text-xs leading-relaxed text-risk-medium">
            {analysis.concentrationNote}
          </p>
        )}
      </Card>
    </div>
  );
}
