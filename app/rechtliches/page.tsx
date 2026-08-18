import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

export default function RechtlichesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="py-16">
        <Container className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Rechtliche Hinweise
          </h1>

          <Card className="mt-8 border-2 border-brand-teal">
            <h2 className="text-lg font-semibold text-foreground">Wichtiger Hinweis</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Finara ist eine Analyseplattform und erbringt keine Anlageberatung, keine
              Finanzportfolioverwaltung und keine Vermittlung von Finanzinstrumenten im Sinne des
              Kreditwesengesetzes (KWG) oder Wertpapierhandelsgesetzes (WpHG). Alle Inhalte —
              insbesondere AI Investment Scores, Reasoning-Texte und Chatbot-Antworten — dienen
              ausschließlich der allgemeinen Information und Selbstinformation und stellen keine
              individuelle Anlageempfehlung, Aufforderung zum Kauf oder Verkauf von
              Finanzinstrumenten dar.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Kapitalanlagen sind mit Risiken bis hin zum Totalverlust des eingesetzten Kapitals
              verbunden. Wertentwicklungen der Vergangenheit, Kennzahlen und KI-Einschätzungen
              sind kein verlässlicher Indikator für zukünftige Ergebnisse. Finara führt niemals
              selbstständig Käufe oder Verkäufe aus — jede Anlageentscheidung triffst
              ausschließlich du.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Diese Plattform befindet sich in der Beta-Phase. Vor einem öffentlichen Launch
              erfolgt eine Prüfung durch spezialisierte Rechtsberatung zur regulatorischen
              Einordnung.
            </p>
          </Card>

          <section id="datenschutz" className="mt-12">
            <h2 className="text-xl font-semibold text-foreground">Datenschutz</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Platzhalter — hier folgt die vollständige Datenschutzerklärung, sobald Umfang der
              Datenverarbeitung (u. a. Depot-Anbindung, WhatsApp-Versand, KI-Analyse) final
              feststeht. Bitte vor Live-Schaltung durch Rechtsberatung prüfen lassen.
            </p>
          </section>

          <section id="impressum" className="mt-12 pb-16">
            <h2 className="text-xl font-semibold text-foreground">Impressum</h2>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Platzhalter — Anbieterkennzeichnung gemäß § 5 TMG / § 18 MStV wird hier ergänzt.
            </p>
          </section>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
