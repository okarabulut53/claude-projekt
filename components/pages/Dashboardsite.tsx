import { requireAppUser } from "@/lib/current-user";
import { getPortfolioPositions } from "@/lib/db";
import { getMarketIndices } from "@/lib/mock/market";
import { getGeneralMarketNews } from "@/lib/mock/news";
import { getAllOpportunities } from "@/lib/mock/opportunities";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { PortfolioSnapshot } from "@/components/dashboard/PortfolioSnapshot";
import { TopOpportunities } from "@/components/dashboard/TopOpportunities";
import { RiskBadge } from "@/components/ui/Badge";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";

export async function Dashboardsite() {
  const appUser = await requireAppUser();
  const riskProfile = appUser.riskProfile!;

  const [positions, indices, opportunities, news] = await Promise.all([
    getPortfolioPositions(appUser.id),
    Promise.resolve(getMarketIndices()),
    getAllOpportunities(),
    getGeneralMarketNews(),
  ]);
  const portfolioSymbols = positions.map((p) => p.symbol);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
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

      <TopOpportunities opportunities={opportunities} />

      <NewsFeed news={news} relevantSymbols={portfolioSymbols} />

      <DisclaimerNote />
    </div>
  );
}
