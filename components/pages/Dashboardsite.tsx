import { requireAppUser } from "@/lib/current-user";
import { getPortfolioPositions } from "@/lib/db";
import { getMarketIndices } from "@/lib/mock/market";
import { getGeneralMarketNews } from "@/lib/mock/news";
import { getOpportunitiesForRiskProfile } from "@/lib/mock/opportunities";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { PortfolioSnapshot } from "@/components/dashboard/PortfolioSnapshot";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";
import { RiskBadge } from "@/components/ui/Badge";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";

export async function Dashboardsite() {
  const appUser = await requireAppUser();
  const riskProfile = appUser.riskProfile!;

  const [positions, indices, opportunities, news] = await Promise.all([
    getPortfolioPositions(appUser.id),
    Promise.resolve(getMarketIndices()),
    getOpportunitiesForRiskProfile(riskProfile),
    getGeneralMarketNews(),
  ]);
  const portfolioSymbols = positions.map((p) => p.symbol);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Dashboard</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Dein täglicher Marktüberblick und deine aktuellen Investmentideen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/60">Dein Risikoprofil:</span>
          <RiskBadge level={riskProfile} />
        </div>
      </div>

      <PortfolioSnapshot positions={positions} />

      <MarketOverview indices={indices} />

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-navy">
            Heutige Investment Opportunities
          </h2>
          <span className="text-xs text-foreground/50">
            Passend zu deinem Risikoprofil &middot; {opportunities.length} Ideen
          </span>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      </div>

      <NewsFeed news={news} relevantSymbols={portfolioSymbols} />

      <DisclaimerNote />
    </div>
  );
}
