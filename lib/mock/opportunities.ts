import { InvestmentOpportunity, RiskProfile } from "@/lib/types";
import { getInstrument } from "./instruments";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

interface OpportunitySeed {
  symbol: string;
  riskLevel: RiskProfile;
  aiScore: number;
  entrySpread: number;
  holdingPeriod: InvestmentOpportunity["holdingPeriod"];
  reasoning: string;
  risks: string;
  assessment: string;
}

const seeds: OpportunitySeed[] = [
  {
    symbol: "SAP",
    riskLevel: "low",
    aiScore: 78,
    entrySpread: 0.015,
    holdingPeriod: "langfristig",
    reasoning:
      "Stabiles Cloud-Wachstum, hohe Marktdurchdringung im Enterprise-Segment und solide Bilanzkennzahlen sprechen für ein attraktives Chancen/Risiko-Verhältnis.",
    risks: "Geringe Volatilität, aber Bewertung auf historisch erhöhtem Niveau; Wachstumstempo im Cloud-Geschäft könnte sich verlangsamen.",
    assessment: "Solide Basisposition für Nutzer mit niedriger Risikobereitschaft und Fokus auf Kapitalerhalt.",
  },
  {
    symbol: "ALV",
    riskLevel: "low",
    aiScore: 81,
    entrySpread: 0.012,
    holdingPeriod: "langfristig",
    reasoning:
      "Konstante Dividendenhistorie, diversifiziertes Versicherungs- und Asset-Management-Geschäft und geringe historische Volatilität.",
    risks: "Zinsänderungen und Großschadenereignisse können die Ergebnisentwicklung belasten.",
    assessment: "Interessante Chance für Nutzer mit niedriger Risikobereitschaft, die Wert auf Ausschüttungen legen.",
  },
  {
    symbol: "EXW1",
    riskLevel: "low",
    aiScore: 74,
    entrySpread: 0.008,
    holdingPeriod: "langfristig",
    reasoning:
      "Breite Streuung über den deutschen Leitindex reduziert Einzeltitelrisiken bei gleichzeitig moderaten laufenden Kosten.",
    risks: "Klumpenrisiko durch Branchengewichtung im DAX, Wertentwicklung folgt eng dem Gesamtmarkt.",
    assessment: "Geeignet für Nutzer mit niedriger Risikobereitschaft als breit gestreuter Basisbaustein.",
  },
  {
    symbol: "SIE",
    riskLevel: "low",
    aiScore: 76,
    entrySpread: 0.014,
    holdingPeriod: "langfristig",
    reasoning:
      "Breit diversifiziertes Industrie- und Digitalisierungsgeschäft mit stabilem Auftragsbestand spricht für ein ausgewogenes Chancen/Risiko-Verhältnis.",
    risks: "Konjunkturabhängigkeit im Industriegeschäft, Margendruck in einzelnen Sparten möglich.",
    assessment: "Solide Basisposition für Nutzer mit niedriger Risikobereitschaft und Interesse an Industriewerten.",
  },
  {
    symbol: "DTE",
    riskLevel: "low",
    aiScore: 72,
    entrySpread: 0.011,
    holdingPeriod: "langfristig",
    reasoning:
      "Stabile Cashflows aus dem Telekommunikationsgeschäft und kontinuierliche Dividendenzahlungen sprechen für ein defensives Profil.",
    risks: "Hoher Kapitalbedarf für Netzausbau, regulatorische Eingriffe in der Telekommunikationsbranche möglich.",
    assessment: "Interessante Chance für Nutzer mit niedriger Risikobereitschaft und Fokus auf Ausschüttungen.",
  },
  {
    symbol: "IUSA",
    riskLevel: "low",
    aiScore: 79,
    entrySpread: 0.009,
    holdingPeriod: "langfristig",
    reasoning:
      "Breite Streuung über den US-Aktienmarkt reduziert Einzeltitelrisiken bei historisch soliden langfristigen Renditen.",
    risks: "Währungsrisiko durch USD-Bezug, hohe Gewichtung einzelner Technologiewerte innerhalb des Index.",
    assessment: "Geeignet für Nutzer mit niedriger Risikobereitschaft als breit gestreuter Basisbaustein.",
  },
  {
    symbol: "VWCE",
    riskLevel: "low",
    aiScore: 77,
    entrySpread: 0.009,
    holdingPeriod: "langfristig",
    reasoning:
      "Globale Streuung über tausende Einzeltitel reduziert regionale und branchenspezifische Klumpenrisiken.",
    risks: "Wertentwicklung folgt eng dem Gesamtmarkt, Übergewichtung des US-Marktes innerhalb des Index.",
    assessment: "Geeignet für Nutzer mit niedriger Risikobereitschaft als breit gestreuter Basisbaustein.",
  },
  {
    symbol: "MSFT",
    riskLevel: "medium",
    aiScore: 84,
    entrySpread: 0.02,
    holdingPeriod: "mittelfristig",
    reasoning:
      "Starkes Momentum im Cloud- und KI-Geschäft, breite Diversifikation über mehrere Produktsegmente und robuste Cashflow-Entwicklung.",
    risks: "Erhöhte Bewertung gegenüber historischem Durchschnitt, regulatorische Diskussionen rund um KI-Themen.",
    assessment: "Interessante Chance für Nutzer mit mittlerer Risikobereitschaft und Fokus auf Wachstum.",
  },
  {
    symbol: "ASML",
    riskLevel: "medium",
    aiScore: 80,
    entrySpread: 0.025,
    holdingPeriod: "mittelfristig",
    reasoning:
      "Quasi-Monopolstellung bei Lithografie-Systemen und hoher Auftragsbestand sprechen für ein günstiges Chancen/Risiko-Profil.",
    risks: "Zyklische Halbleiterbranche, Exportbeschränkungen können Nachfrage aus einzelnen Regionen beeinflussen.",
    assessment: "Für Nutzer mit mittlerer Risikobereitschaft, die Zugang zum Halbleiter-Wachstumsthema suchen.",
  },
  {
    symbol: "BTC",
    riskLevel: "medium",
    aiScore: 73,
    entrySpread: 0.04,
    holdingPeriod: "mittelfristig",
    reasoning:
      "Etablierteste Kryptowährung mit zunehmender institutioneller Nachfrage und positiven Zuflüssen in regulierte Anlageprodukte.",
    risks: "Erhöhte Kursschwankungen, regulatorische Rahmenbedingungen können sich kurzfristig ändern.",
    assessment: "Chance für Nutzer mit mittlerer Risikobereitschaft, die eine begrenzte Krypto-Beimischung erwägen.",
  },
  {
    symbol: "NVDA",
    riskLevel: "high",
    aiScore: 87,
    entrySpread: 0.03,
    holdingPeriod: "kurz- bis mittelfristig",
    reasoning:
      "Kombination aus starkem Momentum, positiven Wachstumserwartungen im KI-Chip-Segment und technischer Unterstützung.",
    risks: "Hohe Bewertung, hohe Wachstumserwartungen bereits eingepreist, erhöhte Volatilität.",
    assessment: "Interessante Chance für Nutzer mit hoher Risikobereitschaft.",
  },
  {
    symbol: "TSLA",
    riskLevel: "high",
    aiScore: 71,
    entrySpread: 0.035,
    holdingPeriod: "kurzfristig",
    reasoning:
      "Hohe Handelsvolumina und ausgeprägtes Momentum bieten kurzfristiges Chancenpotenzial für taktisch orientierte Nutzer.",
    risks: "Starke Kursschwankungen, Margendruck durch Preisanpassungen, hohe Abhängigkeit von Einzelperson und Nachrichtenlage.",
    assessment: "Spekulative Chance für Nutzer mit hoher Risikobereitschaft und kurzem Anlagehorizont.",
  },
  {
    symbol: "SOL",
    riskLevel: "high",
    aiScore: 76,
    entrySpread: 0.06,
    holdingPeriod: "kurz- bis mittelfristig",
    reasoning:
      "Steigende Netzwerkaktivität und wachsendes Ökosystem sprechen für erhöhtes Momentum im Altcoin-Segment.",
    risks: "Sehr hohe Volatilität, geringere Marktkapitalisierung als etablierte Kryptowährungen, technologische Konkurrenz.",
    assessment: "Spekulative Chance für Nutzer mit hoher Risikobereitschaft, die kurzfristige Momentum-Themen suchen.",
  },
  {
    symbol: "ETH",
    riskLevel: "high",
    aiScore: 74,
    entrySpread: 0.05,
    holdingPeriod: "kurz- bis mittelfristig",
    reasoning:
      "Breite Nutzung als Basis-Infrastruktur für dezentrale Anwendungen und wachsende institutionelle Zuflüsse sprechen für erhöhtes Momentum.",
    risks: "Hohe Kursschwankungen, Netzwerk-Upgrades und regulatorische Rahmenbedingungen können sich kurzfristig ändern.",
    assessment: "Chance für Nutzer mit hoher Risikobereitschaft, die eine begrenzte Krypto-Beimischung jenseits von Bitcoin erwägen.",
  },
];

async function buildOpportunity(seed: OpportunitySeed, index: number): Promise<InvestmentOpportunity | null> {
  const instrument = await getInstrument(seed.symbol);
  if (!instrument) return null;
  const entryLow = instrument.price * (1 - seed.entrySpread);
  const entryHigh = instrument.price * (1 + seed.entrySpread * 0.4);
  return {
    id: `opp-${seed.symbol.toLowerCase()}`,
    instrument,
    aiScore: seed.aiScore,
    riskLevel: seed.riskLevel,
    potentialEntryLow: Math.round(entryLow * 100) / 100,
    potentialEntryHigh: Math.round(entryHigh * 100) / 100,
    holdingPeriod: seed.holdingPeriod,
    reasoning: seed.reasoning,
    risks: seed.risks,
    assessment: seed.assessment,
    generatedAt: hoursAgo(index * 2 + 1),
  };
}

export async function getAllOpportunities(): Promise<InvestmentOpportunity[]> {
  const built = await Promise.all(seeds.map((seed, index) => buildOpportunity(seed, index)));
  return built.filter((o): o is InvestmentOpportunity => o !== null);
}

export async function getOpportunitiesForRiskProfile(riskProfile: RiskProfile): Promise<InvestmentOpportunity[]> {
  const all = await getAllOpportunities();
  return all.filter((o) => o.riskLevel === riskProfile).sort((a, b) => b.aiScore - a.aiScore);
}

export async function getOpportunityForSymbol(symbol: string): Promise<InvestmentOpportunity | undefined> {
  const all = await getAllOpportunities();
  return all.find((o) => o.instrument.symbol.toLowerCase() === symbol.toLowerCase());
}
