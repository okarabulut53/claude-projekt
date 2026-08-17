import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-brand-navy text-white/70">
      <Container className="grid gap-10 py-14 md:grid-cols-4">
        <div>
          <div className="text-lg font-bold text-white">finara</div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed">
            KI-gestützte Investment-Analyse für Aktien, ETFs und Kryptowährungen. Wir liefern
            Einschätzungen, du triffst die Entscheidung.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Produkt</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/#funktionen" className="hover:text-white">Funktionen</Link></li>
            <li><Link href="/#scoring" className="hover:text-white">AI Investment Score</Link></li>
            <li><Link href="/#preise" className="hover:text-white">Preise</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Unternehmen</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/rechtliches" className="hover:text-white">Rechtliche Hinweise</Link></li>
            <li><Link href="/rechtliches#datenschutz" className="hover:text-white">Datenschutz</Link></li>
            <li><Link href="/rechtliches#impressum" className="hover:text-white">Impressum</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Kontakt</div>
          <ul className="mt-4 space-y-2 text-sm">
            <li>support@finara.de</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/10 py-6">
        <Container className="text-xs leading-relaxed text-white/50">
          Finara ist eine Analyseplattform und keine Finanzberatung oder Vermögensverwaltung.
          Alle Inhalte dienen ausschließlich der Information und stellen keine Kauf- oder
          Verkaufsempfehlung dar. Kapitalanlagen sind mit Risiken bis hin zum Totalverlust
          verbunden. Wertentwicklungen der Vergangenheit sind kein verlässlicher Indikator für
          zukünftige Ergebnisse.
        </Container>
      </div>
    </footer>
  );
}
