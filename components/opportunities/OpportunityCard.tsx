import Link from "next/link";
import { InvestmentOpportunity } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { RiskBadge, ScoreBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

export function OpportunityCard({ opportunity }: { opportunity: InvestmentOpportunity }) {
  const { instrument } = opportunity;
  return (
    <Link href={`/instrument/${instrument.symbol}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-foreground/50">
              {instrument.symbol} · {instrument.assetClass.toUpperCase()}
            </div>
            <div className="mt-0.5 text-base font-bold text-brand-navy">{instrument.name}</div>
          </div>
          <ScoreBadge score={opportunity.aiScore} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <RiskBadge level={opportunity.riskLevel} />
          <span className="text-xs text-foreground/50">Haltedauer: {opportunity.holdingPeriod}</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">{opportunity.reasoning}</p>
        <div className="mt-3 rounded-lg bg-brand-surface p-3">
          <div className="text-xs font-semibold text-foreground/50">Risiken</div>
          <p className="mt-0.5 text-sm text-foreground/70">{opportunity.risks}</p>
        </div>
        <div className="mt-3 text-xs text-foreground/50">
          Möglicher Einstiegsbereich: {formatCurrency(opportunity.potentialEntryLow, instrument.currency)}
          {" – "}
          {formatCurrency(opportunity.potentialEntryHigh, instrument.currency)}
        </div>
      </Card>
    </Link>
  );
}
