import { AppUser, PortfolioPosition } from "@/lib/types";
import { analyzePortfolio, assetClassLabel } from "@/lib/portfolio-analysis";
import { getOpportunityForSymbol, getOpportunitiesForRiskProfile } from "@/lib/mock/opportunities";
import { formatCurrency } from "@/lib/format";

const glossary: { pattern: RegExp; answer: string }[] = [
  {
    pattern: /\betf\b/i,
    answer:
      "Ein ETF (Exchange Traded Fund) ist ein börsengehandelter Indexfonds, der meist passiv einen Index wie den DAX oder MSCI World nachbildet. ETFs bieten breite Streuung bei vergleichsweise niedrigen Kosten, sind aber genauso den allgemeinen Marktschwankungen ausgesetzt.",
  },
  {
    pattern: /volatilit/i,
    answer:
      "Volatilität beschreibt, wie stark der Kurs eines Wertpapiers in einem bestimmten Zeitraum schwankt. Hohe Volatilität bedeutet größere und häufigere Kursbewegungen in beide Richtungen — also höhere Chancen, aber auch höhere Risiken.",
  },
  {
    pattern: /diversifikation|streuung/i,
    answer:
      "Diversifikation bedeutet, Kapital über verschiedene Anlageklassen, Branchen oder Regionen zu verteilen, um das Risiko einzelner Positionen abzufedern. Eine breite Streuung kann die Auswirkung einzelner Kursverluste auf das Gesamtportfolio verringern.",
  },
  {
    pattern: /risikoprofil/i,
    answer:
      "Dein Risikoprofil (Low, Medium oder High Risk) bestimmt, welche Investmentideen dir angezeigt werden. Es fließt direkt in die Auswahl und Bewertung der Opportunities ein und lässt sich jederzeit in den Einstellungen anpassen.",
  },
];

async function findMentionedSymbol(message: string) {
  const lower = message.toLowerCase();
  const [low, medium, high] = await Promise.all([
    getOpportunitiesForRiskProfile("low"),
    getOpportunitiesForRiskProfile("medium"),
    getOpportunitiesForRiskProfile("high"),
  ]);
  const instruments = low.concat(medium, high).map((o) => o.instrument);
  return instruments.find((i) => {
    const symbolPattern = new RegExp(`\\b${i.symbol.toLowerCase()}\\b`);
    const firstNameWord = i.name.toLowerCase().split(/\s+/)[0];
    return symbolPattern.test(lower) || lower.includes(i.name.toLowerCase()) || lower.includes(firstNameWord);
  });
}

function formatPositionList(positions: PortfolioPosition[]) {
  return positions
    .map((p) => `${p.name} (${p.symbol})`)
    .join(", ");
}

async function opportunitiesForPositions(positions: PortfolioPosition[]) {
  const entries = await Promise.all(
    positions.map(async (p) => [p.symbol, await getOpportunityForSymbol(p.symbol)] as const),
  );
  return new Map(entries.filter((entry): entry is [string, NonNullable<typeof entry[1]>] => Boolean(entry[1])));
}

export async function generateChatReply(
  message: string,
  appUser: AppUser,
  positions: PortfolioPosition[],
): Promise<string> {
  const lower = message.toLowerCase();
  const analysis = analyzePortfolio(positions);

  if (/(guthaben|kontostand|wie viel.*wert|portfolio.*wert)/i.test(lower)) {
    if (positions.length === 0) {
      return "Dazu liegen mir keine verlässlichen Daten vor — du hast aktuell noch keine Portfolio-Positionen hinterlegt. Erfasse Positionen im Portfolio-Bereich, dann kann ich dir deinen aktuellen Wert nennen.";
    }
    const gainWord = analysis.gainAbs >= 0 ? "Gewinn" : "Verlust";
    return `Dein Portfolio ist aktuell ${formatCurrency(analysis.totalValue)} wert (Stand: gerade eben, Basis: deine hinterlegten Positionen). Das entspricht einem ${gainWord} von ${formatCurrency(Math.abs(analysis.gainAbs))} (${analysis.gainPct.toFixed(1)} %) gegenüber deinem Einstand.`;
  }

  if (/verkauf|verkaufen/.test(lower)) {
    if (positions.length === 0) {
      return "Dazu liegen mir keine verlässlichen Daten vor — dein Portfolio enthält aktuell keine Positionen.";
    }
    const opportunityBySymbol = await opportunitiesForPositions(positions);
    const critical = positions.filter((p) => {
      const opportunity = opportunityBySymbol.get(p.symbol);
      return opportunity && opportunity.aiScore < 75;
    });
    if (critical.length === 0) {
      return `Basierend auf den aktuellen AI Scores deiner Positionen (${formatPositionList(positions)}) sehe ich derzeit keine Position mit auffällig schwachem Score. Das ist keine Kaufempfehlung — bitte prüfe deine Positionen trotzdem regelmäßig selbst.`;
    }
    const details = critical
      .map((p) => {
        const opportunity = opportunityBySymbol.get(p.symbol)!;
        return `${p.name} (Score ${opportunity.aiScore}/100, ${opportunity.risks})`;
      })
      .join("; ");
    return `Basierend auf aktuellen Daten würde ich folgende Position(en) kritisch sehen: ${details}. Das ist eine Einschätzung mit Reasoning, keine Verkaufsanweisung — die Entscheidung liegt bei dir.`;
  }

  if (/halten|behalten/.test(lower)) {
    if (positions.length === 0) {
      return "Dazu liegen mir keine verlässlichen Daten vor — dein Portfolio enthält aktuell keine Positionen.";
    }
    const opportunityBySymbol = await opportunitiesForPositions(positions);
    const strong = positions.filter((p) => {
      const opportunity = opportunityBySymbol.get(p.symbol);
      return !opportunity || opportunity.aiScore >= 75;
    });
    const details = strong
      .map((p) => {
        const opportunity = opportunityBySymbol.get(p.symbol);
        return opportunity
          ? `${p.name} (Score ${opportunity.aiScore}/100)`
          : `${p.name} (keine aktuelle AI-Einschätzung verfügbar)`;
      })
      .join(", ");
    return `Basierend auf aktuellen Daten würde ich folgende Position(en) eher halten: ${details || "keine"}. Dies ist eine Einschätzung mit Reasoning, keine Handlungsanweisung.`;
  }

  const mentionedInstrument = await findMentionedSymbol(message);
  if (mentionedInstrument) {
    const opportunity = await getOpportunityForSymbol(mentionedInstrument.symbol);
    if (!opportunity) {
      return `Zu ${mentionedInstrument.name} (${mentionedInstrument.symbol}) liegt aktuell keine aktive AI-Einschätzung vor — der Kurs steht bei ${formatCurrency(mentionedInstrument.price, mentionedInstrument.currency)}.`;
    }
    return `${mentionedInstrument.name} (${mentionedInstrument.symbol}) hat aktuell einen AI Score von ${opportunity.aiScore}/100 (Risiko: ${opportunity.riskLevel}). ${opportunity.reasoning} Risiken: ${opportunity.risks} ${opportunity.assessment}`;
  }

  for (const entry of glossary) {
    if (entry.pattern.test(lower)) return entry.answer;
  }

  if (positions.length > 0 && /verteil|allocation|diversifi/.test(lower)) {
    const parts = analysis.allocation
      .map((a) => `${assetClassLabel[a.assetClass]}: ${a.percent.toFixed(0)} %`)
      .join(", ");
    return `Deine aktuelle Verteilung: ${parts}.${analysis.concentrationNote ? " " + analysis.concentrationNote : ""}`;
  }

  return "Dazu liegen mir aktuell keine verlässlichen Daten vor. Frag mich gern nach deinem Portfolio-Wert, konkreten Instrumenten (z. B. \"Wie sieht NVIDIA aus?\") oder allgemeinen Finanzbegriffen wie ETF oder Volatilität.";
}
