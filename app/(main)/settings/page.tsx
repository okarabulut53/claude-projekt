import { requireAppUser } from "@/lib/current-user";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/Badge";
import { updateRiskProfileSetting, updateWhatsappSetting } from "@/lib/actions/settings";
import { RiskProfile } from "@/lib/types";

const riskOptions: { value: RiskProfile; label: string }[] = [
  { value: "low", label: "Low Risk" },
  { value: "medium", label: "Medium Risk" },
  { value: "high", label: "High Risk" },
];

export default async function SettingsPage() {
  const appUser = await requireAppUser();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-brand-navy">Einstellungen</h1>
        <p className="mt-1 text-sm text-foreground/60">
          Verwalte dein Risikoprofil sowie deine Benachrichtigungs- und Depot-Einstellungen.
        </p>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-brand-navy">Risikoprofil</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Aktuell: <RiskBadge level={appUser.riskProfile ?? "low"} />
        </p>
        <form action={updateRiskProfileSetting} className="mt-4 flex flex-wrap items-center gap-3">
          <select
            name="riskProfile"
            defaultValue={appUser.riskProfile ?? "low"}
            className="rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
          >
            {riskOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="submit">Speichern</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-brand-navy">WhatsApp-Benachrichtigungen</h2>
        <p className="mt-1 text-sm text-foreground/60">
          {appUser.whatsappNumber
            ? `Hinterlegt: ${appUser.whatsappNumber}`
            : "Keine Nummer hinterlegt — Benachrichtigungen gehen an deine E-Mail-Adresse."}
        </p>
        <form action={updateWhatsappSetting} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            name="whatsappNumber"
            type="tel"
            defaultValue={appUser.whatsappNumber ?? ""}
            placeholder="+49 151 23456789"
            className="rounded-lg border border-brand-border px-3 py-2 text-sm outline-none focus:border-brand-teal"
          />
          <Button type="submit">Speichern</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-brand-navy">Depot-Anbindung</h2>
        <p className="mt-1 text-sm leading-relaxed text-foreground/60">
          {appUser.depotConnected
            ? "Dein Depot ist verbunden (read-only)."
            : "Die read-only Depot-Anbindung ist in dieser ersten Version noch nicht aktiv. Erfasse deine Positionen bis dahin manuell im Portfolio-Bereich."}
        </p>
      </Card>
    </div>
  );
}
