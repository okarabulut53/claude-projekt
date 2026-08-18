import Link from "next/link";
import { requireAppUser } from "@/lib/current-user";
import { getChatThreads, getPortfolioPositions, getWatchlist } from "@/lib/db";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { ShieldCheckIcon } from "@/components/icons/Icons";

export async function ErsteSchrittesite() {
  const appUser = await requireAppUser();
  const [positions, threads, watchlist] = await Promise.all([
    getPortfolioPositions(appUser.id),
    getChatThreads(appUser.id),
    getWatchlist(appUser.id),
  ]);

  const steps = [
    {
      title: "Risikoprofil festlegen",
      description: "Bestimmt, welche AI Investment Opportunities zu dir passen.",
      done: Boolean(appUser.riskProfile),
      href: "/settings",
      cta: "In den Einstellungen prüfen",
    },
    {
      title: "WhatsApp-Benachrichtigungen einrichten",
      description: "Optional: erhalte Updates direkt per WhatsApp statt per E-Mail.",
      done: Boolean(appUser.whatsappNumber),
      href: "/settings",
      cta: "Nummer hinterlegen",
    },
    {
      title: "Portfolio-Positionen erfassen",
      description: "Trage deine bestehenden Positionen ein, damit Analysen und Chat darauf basieren können.",
      done: positions.length > 0,
      href: "/portfolio",
      cta: "Position hinzufügen",
    },
    {
      title: "FinaraAI ausprobieren",
      description: "Stelle deine erste Frage zu deinem Portfolio oder einem Instrument.",
      done: threads.length > 0,
      href: "/finaraai",
      cta: "Chat öffnen",
    },
    {
      title: "Watchlist aufbauen",
      description: "Behalte interessante Aktien, ETFs oder Kryptowährungen im Blick.",
      done: watchlist.length > 0,
      href: "/watchlist",
      cta: "Watchlist öffnen",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Erste Schritte</h1>
        <p className="mt-1 text-sm text-foreground/60">
          {doneCount} von {steps.length} Schritten erledigt — so holst du das Meiste aus finara heraus.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <Card key={step.title} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  step.done ? "bg-risk-low-bg text-risk-low" : "bg-brand-surface text-foreground/30"
                }`}
              >
                <ShieldCheckIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-sm font-semibold text-foreground">{step.title}</div>
                <p className="mt-0.5 text-sm text-foreground/60">{step.description}</p>
              </div>
            </div>
            {!step.done && (
              <ButtonLink href={step.href} variant="ghost" className="shrink-0">
                {step.cta}
              </ButtonLink>
            )}
            {step.done && <Link href={step.href} className="shrink-0 text-xs font-medium text-brand-teal hover:underline">Ansehen</Link>}
          </Card>
        ))}
      </div>
    </div>
  );
}
