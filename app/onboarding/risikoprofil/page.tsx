"use client";

import { useState } from "react";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { saveRiskProfile } from "@/lib/actions/onboarding";
import { RiskProfile } from "@/lib/types";

const options: { value: RiskProfile; title: string; description: string }[] = [
  {
    value: "low",
    title: "Low Risk",
    description:
      "Etablierte Unternehmen, stabile Aktien, ETFs und dividendenstarke Werte. Fokus auf Kapitalerhalt.",
  },
  {
    value: "medium",
    title: "Medium Risk",
    description:
      "Growth-Aktien, etablierte Kryptowährungen und ausgewählte Einzelaktien mit höherem Wachstumspotenzial.",
  },
  {
    value: "high",
    title: "High Risk",
    description:
      "Volatile Aktien, Small Caps, Krypto/Altcoins und kurzfristige Momentum-Chancen — spekulativ.",
  },
];

export default function RiskProfileOnboardingPage() {
  const [selected, setSelected] = useState<RiskProfile | null>(null);

  return (
    <OnboardingShell
      activeStep="risikoprofil"
      title="Wähle dein Risikoprofil"
      description="Pflichtschritt: Dein Risikoprofil bestimmt, welche Investmentideen dir angezeigt werden. Du kannst es jederzeit in den Einstellungen ändern."
    >
      <form action={saveRiskProfile} className="space-y-3">
        {options.map((option) => (
          <label
            key={option.value}
            className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
              selected === option.value
                ? "border-brand-teal bg-brand-teal-light"
                : "border-brand-border hover:border-brand-teal/50"
            }`}
          >
            <input
              type="radio"
              name="riskProfile"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              className="sr-only"
              required
            />
            <div className="font-semibold text-foreground">{option.title}</div>
            <div className="mt-1 text-sm text-foreground/70">{option.description}</div>
          </label>
        ))}
        <div className="pt-2">
          <Button type="submit" disabled={!selected}>
            Risikoprofil speichern
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
