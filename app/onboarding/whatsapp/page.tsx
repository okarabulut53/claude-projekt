import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/Button";
import { saveWhatsappNumber, skipWhatsapp } from "@/lib/actions/onboarding";

export default function WhatsappOnboardingPage() {
  return (
    <OnboardingShell
      activeStep="whatsapp"
      title="Benachrichtigungen per WhatsApp"
      description="Hinterlege optional deine WhatsApp-Nummer, um deine tägliche Zusammenfassung neuer Investmentideen dort zu erhalten. Ohne Nummer senden wir sie per E-Mail. Du kannst das jederzeit in den Einstellungen ändern."
    >
      <form action={saveWhatsappNumber} className="space-y-4">
        <div>
          <label htmlFor="whatsappNumber" className="text-sm font-medium text-foreground/70">
            WhatsApp-Nummer
          </label>
          <input
            id="whatsappNumber"
            name="whatsappNumber"
            type="tel"
            placeholder="+49 151 23456789"
            className="mt-1.5 w-full rounded-lg border border-brand-border px-4 py-2.5 text-sm outline-none focus:border-brand-teal"
          />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Speichern &amp; weiter</Button>
          <Button type="submit" formAction={skipWhatsapp} variant="ghost">
            Überspringen
          </Button>
        </div>
      </form>
    </OnboardingShell>
  );
}
