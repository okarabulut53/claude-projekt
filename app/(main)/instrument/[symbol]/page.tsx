import { notFound } from "next/navigation";
import { getInstrument } from "@/lib/mock/instruments";
import { getOpportunityForSymbol } from "@/lib/mock/opportunities";
import { getNewsForSymbols } from "@/lib/mock/news";
import { Card } from "@/components/ui/Card";
import { ChangeBadge, RiskBadge, ScoreBadge } from "@/components/ui/Badge";
import { LineChart } from "@/components/charts/LineChart";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { formatCurrency, formatRelativeTime } from "@/lib/format";

const volatilityRisk = { niedrig: "low", mittel: "medium", hoch: "high" } as const;

export default async function InstrumentDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const instrument = getInstrument(symbol);
  if (!instrument) notFound();

  const opportunity = getOpportunityForSymbol(symbol);
  const news = getNewsForSymbols([instrument.symbol]);
  const positive = instrument.changePercent1d >= 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-foreground/50">
            {instrument.symbol} · {instrument.assetClass.toUpperCase()}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-brand-navy">
            {instrument.name}
          </h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-brand-navy">
            {formatCurrency(instrument.price, instrument.currency)}
          </div>
          <ChangeBadge value={instrument.changePercent1d} />
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-foreground/50">30 Tage</span>
          <span className="text-foreground/30">·</span>
          <span className="text-foreground/70">
            30-Tage-Veränderung: <ChangeBadge value={instrument.changePercent30d} />
          </span>
          <span className="text-foreground/30">·</span>
          <span className="text-foreground/70">Volatilität: {instrument.volatility}</span>
        </div>
        <LineChart
          data={instrument.history}
          positive={positive}
          currencyLabel={instrument.currency}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-navy">AI Investment Score</h2>
              {opportunity && <ScoreBadge score={opportunity.aiScore} />}
            </div>
            {opportunity ? (
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <RiskBadge level={opportunity.riskLevel} />
                  <span className="text-xs text-foreground/50">
                    Haltedauer: {opportunity.holdingPeriod}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground/50">Reasoning</div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                    {opportunity.reasoning}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground/50">Risiken</div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                    {opportunity.risks}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground/50">AI Assessment</div>
                  <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                    {opportunity.assessment}
                  </p>
                </div>
                <div className="text-xs text-foreground/40">
                  Möglicher Einstiegsbereich:{" "}
                  {formatCurrency(opportunity.potentialEntryLow, instrument.currency)} –{" "}
                  {formatCurrency(opportunity.potentialEntryHigh, instrument.currency)} · Stand{" "}
                  {formatRelativeTime(opportunity.generatedAt)}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-foreground/60">
                Für dieses Instrument liegt aktuell keine aktive AI-Einschätzung vor.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-brand-navy">Relevante News</h2>
            {news.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/60">
                Aktuell keine News zu diesem Instrument.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {news.map((item) => (
                  <li key={item.id} className="border-b border-brand-border pb-4 last:border-0 last:pb-0">
                    <div className="text-xs text-foreground/50">
                      {item.source} · {formatRelativeTime(item.publishedAt)}
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-brand-navy">{item.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-foreground/70">{item.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="text-base font-semibold text-brand-navy">Kennzahlen</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-foreground/50">Kurs</dt>
              <dd className="font-medium text-foreground">
                {formatCurrency(instrument.price, instrument.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/50">Tagesveränderung</dt>
              <dd><ChangeBadge value={instrument.changePercent1d} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/50">30-Tage-Veränderung</dt>
              <dd><ChangeBadge value={instrument.changePercent30d} /></dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/50">Volatilität</dt>
              <dd className="font-medium capitalize text-foreground">{instrument.volatility}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-foreground/50">Risikoeinstufung</dt>
              <dd><RiskBadge level={volatilityRisk[instrument.volatility]} /></dd>
            </div>
          </dl>
        </Card>
      </div>

      <DisclaimerNote />
    </div>
  );
}
