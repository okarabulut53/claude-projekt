import { notFound } from "next/navigation";
import { getInstrument } from "@/lib/mock/instruments";
import { getOpportunityForSymbol } from "@/lib/mock/opportunities";
import { getNewsForSymbols } from "@/lib/mock/news";
import { Card } from "@/components/ui/Card";
import { ChangeBadge, DataSourceBadge, RiskBadge, ScoreBadge } from "@/components/ui/Badge";
import { InstrumentChart } from "@/components/instrument/InstrumentChart";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import { syntheticCandlesFromPricePoints, twelveDataToCandles } from "@/lib/chart-transform";
import { liveSymbols } from "@/lib/market-data/symbols";
import { fetchTwelveDataOhlcvOrThrow } from "@/lib/market-data/twelvedata";
import { cached } from "@/lib/market-data/cache";
import { CandleDatum } from "@/components/charts/CandlestickChart";

const volatilityRisk = { niedrig: "low", mittel: "medium", hoch: "high" } as const;

async function loadInitialCandles(symbol: string, history: Parameters<typeof syntheticCandlesFromPricePoints>[1]) {
  const map = liveSymbols[symbol];
  if (!map) return { candles: syntheticCandlesFromPricePoints(symbol, history), isLive: false };

  try {
    const bars = await cached(`chart:${symbol}:1D`, 6 * 3600_000, () =>
      fetchTwelveDataOhlcvOrThrow(map.twelveData, "1day"),
    );
    return { candles: twelveDataToCandles(bars), isLive: true };
  } catch {
    // Twelve Data unavailable/rate-limited right now — still mark isLive so the client
    // component knows to retry via the API route on the next interval switch.
    return { candles: syntheticCandlesFromPricePoints(symbol, history), isLive: true };
  }
}

export default async function InstrumentDetailPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const instrument = await getInstrument(symbol);
  if (!instrument) notFound();

  const [opportunity, news, { candles, isLive }] = await Promise.all([
    getOpportunityForSymbol(symbol),
    getNewsForSymbols([instrument.symbol]),
    loadInitialCandles(instrument.symbol, instrument.history),
  ]);
  const initialCandles: CandleDatum[] = candles;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-foreground/50">
            {instrument.symbol} · {instrument.assetClass.toUpperCase()}
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {instrument.name}
          </h1>
          <div className="mt-2">
            <DataSourceBadge source={instrument.source} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-foreground">
            {formatCurrency(instrument.price, instrument.currency)}
          </div>
          <ChangeBadge value={instrument.changePercent1d} />
        </div>
      </div>

      <InstrumentChart
        symbol={instrument.symbol}
        name={instrument.name}
        currency={instrument.currency}
        initialPrice={instrument.price}
        initialChangePercent={instrument.changePercent1d}
        initialCandles={initialCandles}
        isLive={isLive}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">AI Investment Score</h2>
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
            <h2 className="text-base font-semibold text-foreground">Relevante News</h2>
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
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-sm font-semibold text-foreground hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <h3 className="mt-1 text-sm font-semibold text-foreground">{item.title}</h3>
                    )}
                    {item.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-foreground/70">{item.summary}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="text-base font-semibold text-foreground">Kennzahlen</h2>
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
