import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { skipDepot } from "@/lib/actions/onboarding";

export default function DepotOnboardingPage() {
  return (
    <OnboardingShell
      activeStep="depot"
      title="Depot anbinden"
      description="Verknüpfe dein Depot read-only, damit Finara deine Positionen analysieren kann — es werden nie Käufe oder Verkäufe ausgelöst."
    >
      <div className="rounded-xl border border-dashed border-brand-border bg-brand-surface p-4 text-sm text-foreground/70">
        Die read-only Depot-Anbindung (z. B. über finAPI) ist in dieser ersten Version noch nicht
        aktiv. Du kannst deine Positionen stattdessen jederzeit manuell im Portfolio-Bereich
        erfassen — die echte Anbindung folgt in einem späteren Schritt.
      </div>
      <form action={skipDepot} className="mt-6">
        <Button type="submit">Weiter</Button>
      </form>
    </OnboardingShell>
  );
}
