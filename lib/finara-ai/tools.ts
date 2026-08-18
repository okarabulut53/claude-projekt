import Anthropic from "@anthropic-ai/sdk";
import { AppUser, PortfolioPosition, RiskProfile } from "@/lib/types";
import { analyzePortfolio, assetClassLabel } from "@/lib/portfolio-analysis";
import { getOpportunitiesForRiskProfile, getOpportunityForSymbol, getAllOpportunities } from "@/lib/mock/opportunities";
import { getInstrument } from "@/lib/mock/instruments";
import { glossary } from "@/lib/chat-engine";
import { formatCurrency } from "@/lib/format";

export const financeTools: Anthropic.Tool[] = [
  {
    name: "get_portfolio_summary",
    description:
      "Liefert den aktuellen Gesamtwert, Gewinn/Verlust und die Verteilung des Portfolios des Nutzers. Immer aufrufen, bevor Zahlen zum Portfolio genannt werden.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_opportunities",
    description:
      "Liefert aktuelle AI Investment Opportunities (Score, Risiko, Einstiegsbereich, Reasoning, Risiken), optional gefiltert nach Risikoklasse.",
    input_schema: {
      type: "object",
      properties: {
        riskLevel: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Optionale Risikoklasse zum Filtern.",
        },
      },
    },
  },
  {
    name: "get_instrument",
    description:
      "Liefert Kurs, Tages-/30-Tage-Veränderung und Volatilität für ein einzelnes Instrument anhand seines Symbols (z. B. NVDA, SAP, BTC).",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. NVDA oder SAP." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "explain_term",
    description: "Erklärt einen Finanzbegriff aus dem internen Glossar (z. B. ETF, Volatilität, Diversifikation).",
    input_schema: {
      type: "object",
      properties: {
        term: { type: "string", description: "Der zu erklärende Begriff." },
      },
      required: ["term"],
    },
  },
];

/**
 * Not a data-fetching tool: this is the structured-output channel. Call it as the FINAL
 * response for an instrument/chart-focused technical read instead of writing free text, so the
 * UI can render a consistent Trend/Support-Resistance/Risiko card instead of a prose bubble.
 */
export const marketAnalysisTool: Anthropic.Tool = {
  name: "present_market_analysis",
  description:
    "Gibt eine strukturierte Markteinschätzung zu einem einzelnen Instrument zurück (Trend, Unterstützung/Widerstand, Risiko-Einschätzung, Fazit). Nur aufrufen, wenn eine chart-/instrumentenbezogene technische Einschätzung gefragt ist — nicht für Portfolio-, Glossar- oder allgemeine Fragen. Muss nach get_instrument aufgerufen werden, damit Kurs und AI Score korrekt sind.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Instrumenten-Symbol, das analysiert wird." },
      trend: {
        type: "string",
        description:
          "Kurze Trend-Einschätzung (z. B. Aufwärtstrend, Seitwärtsbewegung, Abwärtstrend) mit knapper Begründung, gestützt auf changePercent1d/30d aus get_instrument.",
      },
      supportResistance: {
        type: "string",
        description:
          "Visuelle Einschätzung möglicher Unterstützungs-/Widerstandszonen basierend auf dem Kursverlauf bzw. dem beigefügten Chart-Bild. Explizit als Schätzung kennzeichnen ('visuelle Einschätzung, keine exakte Kennzahl'), nicht als verifizierte Zahl darstellen.",
      },
      riskAssessment: {
        type: "string",
        description: "Risiko-Einschätzung im Chance/Risiko-Framing, ohne Renditeversprechen.",
      },
      summary: { type: "string", description: "Fazit in 1-2 Sätzen." },
    },
    required: ["symbol", "trend", "supportResistance", "riskAssessment", "summary"],
  },
};

export async function runFinanceTool(
  name: string,
  input: Record<string, unknown>,
  appUser: AppUser,
  positions: PortfolioPosition[],
): Promise<string> {
  switch (name) {
    case "get_portfolio_summary": {
      if (positions.length === 0) {
        return JSON.stringify({ hasPositions: false, message: "Der Nutzer hat noch keine Portfolio-Positionen hinterlegt." });
      }
      const analysis = analyzePortfolio(positions);
      return JSON.stringify({
        hasPositions: true,
        totalValue: formatCurrency(analysis.totalValue),
        gainAbs: formatCurrency(analysis.gainAbs),
        gainPct: `${analysis.gainPct.toFixed(1)} %`,
        allocation: analysis.allocation.map((a) => ({
          assetClass: assetClassLabel[a.assetClass],
          percent: `${a.percent.toFixed(0)} %`,
        })),
        concentrationNote: analysis.concentrationNote,
        positions: positions.map((p) => ({ symbol: p.symbol, name: p.name, quantity: p.quantity })),
      });
    }
    case "get_opportunities": {
      const riskLevel = input.riskLevel as RiskProfile | undefined;
      const opportunities = riskLevel ? await getOpportunitiesForRiskProfile(riskLevel) : await getAllOpportunities();
      return JSON.stringify(
        opportunities.slice(0, 10).map((o) => ({
          symbol: o.instrument.symbol,
          name: o.instrument.name,
          aiScore: o.aiScore,
          riskLevel: o.riskLevel,
          entryRange: `${formatCurrency(o.potentialEntryLow, o.instrument.currency)} – ${formatCurrency(o.potentialEntryHigh, o.instrument.currency)}`,
          holdingPeriod: o.holdingPeriod,
          reasoning: o.reasoning,
          risks: o.risks,
          assessment: o.assessment,
        })),
      );
    }
    case "get_instrument": {
      const symbol = String(input.symbol ?? "");
      const instrument = await getInstrument(symbol);
      if (!instrument) return JSON.stringify({ found: false, message: `Kein Instrument mit Symbol ${symbol} gefunden.` });
      const opportunity = await getOpportunityForSymbol(symbol);
      return JSON.stringify({
        found: true,
        symbol: instrument.symbol,
        name: instrument.name,
        price: formatCurrency(instrument.price, instrument.currency),
        changePercent1d: `${instrument.changePercent1d.toFixed(1)} %`,
        changePercent30d: `${instrument.changePercent30d.toFixed(1)} %`,
        volatility: instrument.volatility,
        dataSource: instrument.source,
        aiOpportunity: opportunity
          ? {
              aiScore: opportunity.aiScore,
              riskLevel: opportunity.riskLevel,
              reasoning: opportunity.reasoning,
              risks: opportunity.risks,
              assessment: opportunity.assessment,
            }
          : null,
      });
    }
    case "explain_term": {
      const term = String(input.term ?? "").toLowerCase();
      const entry = glossary.find((g) => g.pattern.test(term));
      return entry ? entry.answer : "Für diesen Begriff liegt kein Glossar-Eintrag vor.";
    }
    default:
      return "Unbekanntes Tool.";
  }
}
