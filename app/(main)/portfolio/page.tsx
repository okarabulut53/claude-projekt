import { requireAppUser } from "@/lib/current-user";
import { getPortfolioPositions } from "@/lib/db";
import { analyzePortfolio } from "@/lib/portfolio-analysis";
import { AllocationSummary } from "@/components/portfolio/AllocationSummary";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { AddPositionForm } from "@/components/portfolio/AddPositionForm";
import { Card } from "@/components/ui/Card";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";

export default async function PortfolioPage() {
  const appUser = await requireAppUser();
  const positions = await getPortfolioPositions(appUser.id);
  const analysis = analyzePortfolio(positions);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Portfolio</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {appUser.depotConnected
            ? "Depot verbunden — Positionen werden automatisch synchronisiert."
            : "Noch kein Depot verbunden. Erfasse deine Positionen manuell oder verknüpfe dein Depot in den Einstellungen (read-only)."}
        </p>
      </div>

      {positions.length > 0 && <AllocationSummary analysis={analysis} />}

      <Card>
        <h2 className="text-base font-semibold text-brand-navy">Positionen</h2>
        <div className="mt-4">
          <PositionsTable positions={positions} />
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-brand-navy">Position manuell hinzufügen</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Kurse für hinterlegte Symbole aus unserer Instrumenten-Liste werden automatisch
          aktualisiert, sonst wird der Einstandspreis als aktueller Preis angenommen.
        </p>
        <div className="mt-4">
          <AddPositionForm />
        </div>
      </Card>

      <DisclaimerNote />
    </div>
  );
}
