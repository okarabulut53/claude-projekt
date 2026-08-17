import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { RiskBadge, ScoreBadge } from "@/components/ui/Badge";
import { IconTile } from "@/components/ui/IconTile";
import { HeroVisual } from "@/components/illustrations/HeroVisual";
import {
  BellIcon,
  ChartLineIcon,
  ChatBubbleIcon,
  GaugeScoreIcon,
  RocketIcon,
  ShieldCheckIcon,
  SlidersIcon,
} from "@/components/icons/Icons";

const features = [
  {
    icon: ChartLineIcon,
    title: "Marktüberblick in Echtzeit",
    description:
      "Kursverläufe der wichtigsten Indizes, Aktien, ETFs und Kryptowährungen auf einen Blick — inklusive Tages-, Wochen- und Monatsansicht.",
  },
  {
    icon: GaugeScoreIcon,
    title: "Täglicher AI Investment Score",
    description:
      "Jedes analysierte Asset erhält einen nachvollziehbaren Score aus Momentum, Bewertung, Risiko und Marktstimmung — mit Begründung statt Blackbox.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Portfolio-Analyse, read-only",
    description:
      "Depot manuell erfassen oder read-only anbinden. Finara zeigt Risikoverteilung, Diversifikation und mögliche Schwachstellen auf.",
  },
  {
    icon: ChatBubbleIcon,
    title: "Chatbot für alle Finanzfragen",
    description:
      "Ob Portfolio-Frage oder allgemeines Finanzthema — der Chatbot antwortet auf Basis echter Daten, nie geraten.",
  },
  {
    icon: BellIcon,
    title: "Benachrichtigungen, die ankommen",
    description:
      "Tägliche Zusammenfassung neuer Investmentideen per WhatsApp oder E-Mail — passend zu deinem Risikoprofil.",
  },
  {
    icon: SlidersIcon,
    title: "Transparente Risikoeinstufung",
    description:
      "Low, Medium oder High Risk — dein Profil bestimmt, welche Chancen dir angezeigt werden. Jederzeit änderbar.",
  },
];

const riskProfiles = [
  {
    level: "low" as const,
    icon: ShieldCheckIcon,
    title: "Low Risk",
    description:
      "Etablierte Unternehmen, stabile Aktien, ETFs und dividendenstarke Werte. Fokus auf Kapitalerhalt bei geringer Volatilität.",
  },
  {
    level: "medium" as const,
    icon: ChartLineIcon,
    title: "Medium Risk",
    description:
      "Growth-Aktien, etablierte Kryptowährungen und ausgewählte Einzelaktien mit höherem Wachstumspotenzial.",
  },
  {
    level: "high" as const,
    icon: RocketIcon,
    title: "High Risk",
    description:
      "Volatile Aktien, Small Caps, Krypto/Altcoins und kurzfristige Momentum-Chancen für spekulative Investments.",
  },
];

export function Hauptseite() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main>
        {/* Hero */}
        <section className="overflow-hidden bg-brand-surface">
          <Container className="grid items-center gap-12 py-20 md:grid-cols-2 md:py-28">
            <div>
              <span className="inline-flex items-center rounded-full bg-brand-teal-light px-4 py-1.5 text-xs font-semibold text-brand-teal">
                KI-gestützte Investmentanalyse
              </span>
              <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-brand-navy md:text-5xl">
                Investmentchancen erkennen.
                <br />
                Entscheiden bleibt bei dir.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground/70">
                Finara analysiert täglich Aktien, ETFs und Kryptowährungen, bewertet Chancen und
                Risiken und erklärt dir jede Einschätzung nachvollziehbar. Keine automatische
                Orderausführung, keine Renditeversprechen — nur fundierte Entscheidungsgrundlagen.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Show when="signed-in">
                  <ButtonLink href="/dashboard">Zum Dashboard</ButtonLink>
                </Show>
                <Show when="signed-out">
                  <SignUpButton>
                    <button className="inline-flex items-center justify-center rounded-full bg-brand-teal px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-teal/90">
                      Kostenlos starten
                    </button>
                  </SignUpButton>
                </Show>
                <Link
                  href="#scoring"
                  className="inline-flex items-center justify-center rounded-full border border-brand-border px-6 py-3 text-sm font-semibold text-brand-navy hover:bg-white"
                >
                  So funktioniert der AI Score
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-foreground/50">
                <span>Aktien · ETFs · Krypto</span>
                <span>Fokus Deutschland &amp; Europa</span>
                <span>Tägliche Analyse</span>
                <span>Keine automatische Orderausführung</span>
              </div>
            </div>

            <HeroVisual>
              <Card className="shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-foreground/50">Investment Opportunity</div>
                    <div className="mt-1 text-lg font-bold text-brand-navy">NVIDIA Corp. · NVDA</div>
                  </div>
                  <ScoreBadge score={87} />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <RiskBadge level="high" />
                  <span className="text-xs text-foreground/50">Haltedauer: 6–12 Monate</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-foreground/70">
                  Kombination aus starkem Momentum, positiven Wachstumserwartungen und technischer
                  Unterstützung.
                </p>
                <div className="mt-4 rounded-xl bg-brand-surface p-4">
                  <div className="text-xs font-semibold text-foreground/50">Risiken</div>
                  <p className="mt-1 text-sm text-foreground/70">
                    Hohe Bewertung, hohe Wachstumserwartungen, erhöhte Volatilität.
                  </p>
                </div>
                <p className="mt-4 text-xs text-foreground/40">
                  Interessante Chance für Nutzer mit hoher Risikobereitschaft — keine Kauf- oder
                  Verkaufsempfehlung.
                </p>
              </Card>
            </HeroVisual>
          </Container>
        </section>

        {/* Funktionen */}
        <section id="funktionen" className="py-24">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                Alles, was du für fundierte Entscheidungen brauchst
              </h2>
              <p className="mt-4 text-foreground/70">
                Von der ersten Marktübersicht bis zur Detailanalyse einzelner Positionen —
                Finara bündelt Daten, KI-Analyse und Transparenz an einem Ort.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <IconTile>
                    <feature.icon />
                  </IconTile>
                  <h3 className="mt-4 text-base font-semibold text-brand-navy">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                    {feature.description}
                  </p>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* Scoring */}
        <section id="scoring" className="bg-brand-navy py-24 text-white">
          <Container className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-brand-teal">
                AI Investment Score
              </span>
              <h2 className="mt-6 text-3xl font-bold tracking-tight">
                Ein Score, der erklärt statt behauptet
              </h2>
              <p className="mt-4 leading-relaxed text-white/70">
                Der AI Investment Score kombiniert regelbasierte, quantitative Kennzahlen —
                Momentum, Bewertung, Volatilität, technische Situation — mit einer KI-Analyse von
                Nachrichten und Marktstimmung. Kein reiner Sprachmodell-Output ohne Grundlage.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-white/70">
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                  Quantitative Analyse und KI-Reasoning getrennt, dann kombiniert
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                  Jede Empfehlung erklärt Chancen, Risiken und zugrunde liegende Annahmen
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />
                  Angepasst an dein persönliches Risikoprofil — nicht generisch
                </li>
              </ul>
            </div>
            <Card className="bg-white text-foreground">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-foreground/50">Beispiel-Analyse</div>
                <ScoreBadge score={82} />
              </div>
              <div className="mt-2 text-lg font-bold text-brand-navy">
                Allianz SE · ALV
              </div>
              <div className="mt-3">
                <RiskBadge level="low" />
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="font-semibold text-foreground/60">Reasoning</div>
                  <p className="text-foreground/70">
                    Konstante Dividendenhistorie, diversifiziertes Geschäftsmodell und geringe
                    historische Volatilität sprechen für ein attraktives Chancen/Risiko-Verhältnis.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-foreground/60">Risiken</div>
                  <p className="text-foreground/70">
                    Zinsänderungen und Großschadenereignisse können die Ergebnisentwicklung
                    belasten.
                  </p>
                </div>
              </div>
            </Card>
          </Container>
        </section>

        {/* Risikoprofile */}
        <section className="py-24">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                Dein Risikoprofil steuert deine Vorschläge
              </h2>
              <p className="mt-4 text-foreground/70">
                Zwei Nutzer mit unterschiedlichem Risikoprofil erhalten am selben Tag
                unterschiedliche Investmentideen — dein Profil ist zentraler Teil des Scorings,
                nicht nur ein Filter danach.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {riskProfiles.map((profile) => (
                <Card key={profile.level}>
                  <div className="flex items-center justify-between">
                    <IconTile>
                      <profile.icon />
                    </IconTile>
                    <RiskBadge level={profile.level} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-brand-navy">{profile.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/70">
                    {profile.description}
                  </p>
                </Card>
              ))}
            </div>
          </Container>
        </section>

        {/* Preise */}
        <section id="preise" className="bg-brand-surface py-24">
          <Container>
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-brand-navy">
                Einfacher Einstieg, faire Preise
              </h2>
              <p className="mt-4 text-foreground/70">
                Finara befindet sich aktuell in der Beta-Phase. Die Nutzung ist während dieser
                Zeit kostenlos.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <Card className="border-2 border-brand-teal">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-teal">
                  Beta
                </div>
                <div className="mt-2 text-3xl font-bold text-brand-navy">Kostenlos</div>
                <p className="mt-2 text-sm text-foreground/70">
                  Voller Zugriff auf Dashboard, AI Investment Score, Suche, Chatbot und
                  Portfolio-Analyse während der Beta-Phase.
                </p>
                <Show when="signed-out">
                  <SignUpButton>
                    <button className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-teal px-6 py-3 text-sm font-semibold text-white hover:bg-brand-teal/90">
                      Jetzt registrieren
                    </button>
                  </SignUpButton>
                </Show>
              </Card>
              <Card>
                <div className="text-xs font-semibold uppercase tracking-wide text-foreground/40">
                  Pro
                </div>
                <div className="mt-2 text-3xl font-bold text-brand-navy">Bald verfügbar</div>
                <p className="mt-2 text-sm text-foreground/70">
                  Erweiterte Analysen, mehr Depot-Anbindungen und WhatsApp-Benachrichtigungen für
                  aktive Nutzer. Preise folgen nach Ende der Beta-Phase.
                </p>
              </Card>
            </div>
          </Container>
        </section>

        {/* CTA */}
        <section className="py-24">
          <Container>
            <Card className="flex flex-col items-center gap-6 bg-brand-navy py-16 text-center text-white">
              <h2 className="text-3xl font-bold tracking-tight">
                Bereit für transparente Investmentanalyse?
              </h2>
              <p className="max-w-lg text-white/70">
                Registriere dich kostenlos, wähle dein Risikoprofil und erhalte deine erste
                Analyse noch heute.
              </p>
              <Show when="signed-out">
                <SignUpButton>
                  <button className="inline-flex items-center justify-center rounded-full bg-brand-teal px-6 py-3 text-sm font-semibold text-white hover:bg-brand-teal/90">
                    Kostenlos starten
                  </button>
                </SignUpButton>
              </Show>
              <Show when="signed-in">
                <ButtonLink href="/dashboard" className="bg-brand-teal">
                  Zum Dashboard
                </ButtonLink>
              </Show>
            </Card>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
