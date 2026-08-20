import Anthropic from "@anthropic-ai/sdk";
import { AppUser, ChatMessage, Instrument, PortfolioPosition, RiskProfile } from "@/lib/types";
import { analyzePortfolio, assetClassLabel } from "@/lib/portfolio-analysis";
import { getOpportunitiesForRiskProfile, getOpportunityForSymbol, getAllOpportunities } from "@/lib/mock/opportunities";
import { getAllInstruments, getInstrument } from "@/lib/mock/instruments";
import { getGeneralMarketNews, getNewsForSymbols } from "@/lib/mock/news";
import { getMarketIndices } from "@/lib/mock/market";
import { getWatchlist } from "@/lib/db";
import { glossary } from "@/lib/chat-engine";
import { formatCurrency } from "@/lib/format";
import { computeAnalysis, ValuationInput } from "@/lib/analysis";
import { applyAllStrategies, applyStrategy, getStrategy } from "@/lib/strategy";
import { resolveStrategyForUser } from "@/lib/orchestrator";
import { fetchFinnhubRecommendationTrends, FinnhubRecommendationCounts } from "@/lib/market-data/finnhub";
import { liveSymbols } from "@/lib/market-data/symbols";
import { cached } from "@/lib/market-data/cache";
import { wasTwelveDataRateLimitedRecently, fmpDailyResetLabel, FmpDailyLimitReachedError } from "@/lib/market-data/rateLimitQueue";
import { isFmpConfigured, hasFundamentalsCoverage, getFundamentalsSummary, getCompanyProfile } from "@/lib/data-providers/fmp";
import { findExportableAnalysis } from "./exportData";
import { exportToCsv, exportToDocx, exportToPptx } from "./export";
import { getIntradayTechnicals, IntradayTimeframe } from "./intradayTechnicals";
import { computeMarketStatus } from "./marketStatus";
import { getPivotPoints, PivotTimeframe } from "./pivotPoints";
import { getPerformanceTable, getMultiHorizonSignal, getExtendedFundamentals } from "./stockReport";

/** Analyst-consensus counts only exist for symbols with a Finnhub stock ticker — crypto/ETFs
 *  legitimately have none, so this returns null rather than calling an endpoint that can't
 *  answer for them. */
async function fetchAnalystCountsFor(symbol: string): Promise<FinnhubRecommendationCounts | null> {
  const map = liveSymbols[symbol];
  if (!map) return null;
  return fetchFinnhubRecommendationTrends(map.finnhub);
}

/**
 * Valuation input for the "long-term" strategy (lib/strategy/config.ts) — getFundamentalsSummary
 * already gates on isFmpConfigured()/hasFundamentalsCoverage() internally and returns null
 * cheaply (no network call) for anything outside the FMP coverage set (NVDA/MSFT/TSLA), so this
 * is safe to call unconditionally for every candidate the same way every other score input is
 * always fetched regardless of which specific strategy a caller ultimately asked for. Same
 * quota-exhaustion degrade-to-null pattern as getSectorSafe above: a `long-term` ranking must
 * still return partial results (renormalized away from valuation, same as an unavailable score
 * from any other factor) rather than fail outright just because FMP's daily quota ran out.
 */
async function getValuationInputSafe(symbol: string): Promise<ValuationInput | null> {
  try {
    const summary = await getFundamentalsSummary(symbol);
    if (!summary) return null;
    return {
      peRatio: summary.peRatio,
      pegRatio: summary.pegRatio,
      dividendYield: summary.dividendYield,
      debtToEquity: summary.debtToEquity,
    };
  } catch (err) {
    if (err instanceof FmpDailyLimitReachedError) return null;
    throw err;
  }
}

/**
 * Cached 90s per symbol (within the 60-120s window get_ranking's watchlistOnly/screener requests
 * and repeated get_analysis follow-ups need — see CHATBOT_ANALYSE.md's rate-limit finding):
 * get_ranking calls this once per candidate, so an uncached version means every ranking request
 * re-fetches analyst-consensus data (lib/market-data/finnhub.ts has no cache of its own) and
 * recomputes every score from scratch for symbols that were just analyzed seconds ago.
 */
async function computeAnalysisForInstrument(instrument: Instrument) {
  return cached(`analysis:${instrument.symbol}`, 90_000, async () => {
    const [newsItems, analystCounts, valuationInput] = await Promise.all([
      getNewsForSymbols([instrument.symbol]),
      fetchAnalystCountsFor(instrument.symbol),
      getValuationInputSafe(instrument.symbol),
    ]);
    return computeAnalysis(instrument.symbol, instrument.history, newsItems, analystCounts, valuationInput);
  });
}

const RATE_LIMIT_NOTE = "Datenquelle aktuell ausgelastet, bitte in Kürze erneut versuchen.";

/** null → the JSON string "nicht verfügbar" per Nutzer-Vorgabe: never a bare null/0 for a missing
 *  fundamentals field, so Claude can't mistake "no data" for "value is zero". */
function fmtFundamentalNumber(value: number | null, digits = 2): string {
  return value === null ? "nicht verfügbar" : value.toFixed(digits);
}

/**
 * Sector lookup for get_watchlist/get_portfolio_summary enrichment below. Unlike
 * getFundamentalsSummary (gated to FUNDAMENTALS_COVERED_SYMBOLS), getCompanyProfile answers for
 * every stock symbol on finara's FMP plan — but it still spends one of the shared 250/day FMP
 * requests per uncached symbol, and still throws FmpDailyLimitReachedError once that's exhausted.
 * Watchlist/portfolio views must degrade to "sector unknown" rather than fail outright just
 * because the fundamentals quota ran out elsewhere in the same day — so this swallows exactly
 * that one error instead of letting it propagate like get_fundamentals does.
 */
async function getSectorSafe(symbol: string): Promise<string | null> {
  if (!isFmpConfigured()) return null;
  try {
    const profile = await getCompanyProfile(symbol);
    return profile?.sector ?? null;
  } catch (err) {
    if (err instanceof FmpDailyLimitReachedError) return null;
    throw err;
  }
}

/**
 * Portfolio value grouped by sector (stock positions only — ETFs/crypto have no FMP sector and
 * are folded into the "unclassifiable" bucket alongside stocks FMP has no profile for). Kept
 * separate from lib/portfolio-analysis.ts's synchronous analyzePortfolio (used by the dashboard
 * and portfolio page, which can't await a network call) rather than changing that function's
 * signature — this is chat-tool-only enrichment.
 */
async function computeSectorAllocation(
  positions: PortfolioPosition[],
): Promise<{ rows: { sector: string; percent: string }[]; unclassifiedNote: string | null }> {
  const totalValue = positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
  if (totalValue <= 0) return { rows: [], unclassifiedNote: null };

  const stockSymbols = Array.from(new Set(positions.filter((p) => p.assetClass === "stock").map((p) => p.symbol)));
  const sectorEntries = await Promise.all(stockSymbols.map(async (symbol) => [symbol, await getSectorSafe(symbol)] as const));
  const sectorBySymbol = new Map(sectorEntries);

  const bySector = new Map<string, number>();
  let unclassifiedValue = 0;
  for (const position of positions) {
    const value = position.quantity * position.currentPrice;
    const sector = position.assetClass === "stock" ? sectorBySymbol.get(position.symbol) : null;
    if (sector) {
      bySector.set(sector, (bySector.get(sector) ?? 0) + value);
    } else {
      unclassifiedValue += value;
    }
  }

  const rows = Array.from(bySector.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([sector, value]) => ({ sector, percent: `${((value / totalValue) * 100).toFixed(0)} %` }));

  const unclassifiedPercent = (unclassifiedValue / totalValue) * 100;
  const unclassifiedNote =
    unclassifiedPercent > 0
      ? `${unclassifiedPercent.toFixed(0)} % des Portfolios sind nicht nach Sektor klassifizierbar (ETFs, Kryptowährungen, oder Aktien ohne Sektor-Datenabdeckung bzw. nicht konfigurierte Fundamentaldaten-Anbindung).`
      : null;

  return { rows, unclassifiedNote };
}

export const financeTools: Anthropic.Tool[] = [
  {
    name: "get_portfolio_summary",
    description:
      "Liefert den aktuellen Gesamtwert, Gewinn/Verlust und die Verteilung des Portfolios des Nutzers, inklusive Sektorallokation (sectorAllocation, aus Financial-Modeling-Prep-Firmendaten für Aktienpositionen; ETFs/Kryptowährungen und Aktien ohne Sektor-Datenabdeckung fallen in unclassifiedNote). Immer aufrufen, bevor Zahlen zum Portfolio genannt werden.",
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
    name: "get_analysis",
    description:
      "Liefert die tatsächlich berechnete Analyse für ein Instrument (aus echter Kurshistorie/News/Analystendaten, nie geschätzt): momentum, risk, technical (RSI/MACD/SMA/Bollinger/Stochastic/ADX-Blend), volume (heutiges vs. 30-Tage-Ø-Volumen), sentiment (News-Keyword-Sentiment), analystConsensus (echte Analysten-Ratings) und marketEnvironment (aktuell immer 'unavailable' — keine VIX-/Marktumfeld-Datenquelle angebunden). Dazu den daraus kombinierten Score für jede definierte Investment-Strategie (Momentum, Balanced, Intraday, Langfristig — Langfristig gewichtet Fundamentaldaten/valuation und Analysten-Konsens hoch, Technisch/Sentiment gering, siehe get_ranking für den typischen Anwendungsfall einer langfristigen Anfrage). Bei jeder technischen/analytischen Einschätzung zu einem Instrument zusätzlich zu get_instrument aufrufen — der aiOpportunity-Wert aus get_instrument ist eine redaktionelle Platzhalter-Einschätzung, keine berechnete Analyse. Nenne nie einen Score oder Faktor, der nicht direkt aus diesem Tool-Ergebnis stammt. WICHTIG zur Richtung: bei ALLEN Scores (auch risk!) bedeutet höher = GÜNSTIGER/positiver für eine positive Einschätzung — ein risk-Score von z. B. 79/100 bedeutet ein UNTERDURCHSCHNITTLICH riskantes (also risikoarmes) Profil, nicht 'hohes Risiko'. analystConsensus ist für Krypto/ETFs strukturell fast immer 'unavailable' (keine Analystenabdeckung) — das ist normal, keine fehlende Berechnung. Ist ein Score 'unavailable', zitiere die gelieferte unavailableReason statt selbst zu schätzen.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. NVDA oder SAP." },
        strategyId: {
          type: "string",
          description:
            "Optional: welche Strategie hervorgehoben werden soll (\"momentum\", \"balanced\" oder \"long-term\"). Ohne Angabe wird die zum Risikoprofil des Nutzers passende Standard-Strategie verwendet (im Ergebnis als defaultStrategy markiert).",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_ranking",
    description:
      "Berechnet einen Score für eine Kandidatenliste und liefert die Top-N sortiert. Bei Anfragen nach den 'besten'/'aussichtsreichsten'/'empfohlenen' Instrumenten aufrufen — das ist ein Score-Ranking, KEINE Kaufempfehlung. Standard-Gewichtung (strategyId ohne Angabe oder \"intraday\") ist der kurzfristige Score aus Technisch/Volumen/News-Sentiment/Analysten-Konsens/Marktumfeld. Für eine LANGFRISTIGE Empfehlungs-/Investitions-Anfrage (z. B. 'welche Aktie würdest du langfristig empfehlen?', 'was ist aktuell eine gute langfristige Investition?') stattdessen strategyId=\"long-term\" verwenden — dort dominieren Fundamentaldaten (valuation: KGV/PEG/Dividendenrendite/Verschuldungsgrad) und Analysten-Konsens, während Technisch/Sentiment nur gering gewichtet sind (kurzfristiges Rauschen). valuation ist strukturell nur für NVDA/MSFT/TSLA verfügbar — für jedes andere Symbol renormiert das Ranking automatisch auf die verbleibenden Faktoren, das ist normal, keine fehlende Berechnung. Mit watchlistOnly=true wird NUR die Watchlist des Nutzers bewertet statt aller bei finara geführten Instrumente — dafür aufrufen bei Anfragen wie 'Bewerte meine Watchlist nach Score', 'Wie schneiden meine Watchlist-Werte ab?' (das ist eine SCORE-Anfrage zur Watchlist, kein reiner Risiko-/Sektor-Überblick — dafür weiterhin get_watchlist nutzen). Ergebnis danach über present_ranking ausgeben, nie als eigene Empfehlung formulieren.",
    input_schema: {
      type: "object",
      properties: {
        strategyId: {
          type: "string",
          description: "Welche Strategie/Gewichtung fürs Ranking verwendet wird: \"intraday\" (Standard), \"momentum\", \"balanced\" oder \"long-term\".",
        },
        limit: { type: "number", description: "Wie viele Top-Kandidaten zurückgegeben werden sollen. Ohne Angabe: 3, außer watchlistOnly=true (dann alle Watchlist-Instrumente)." },
        assetClass: {
          type: "string",
          enum: ["stock", "etf", "crypto"],
          description: "Optionale Einschränkung auf eine Asset-Klasse.",
        },
        watchlistOnly: {
          type: "boolean",
          description: "true = nur die Watchlist des Nutzers bewerten statt der vollen, vorgefilterten finara-Kandidatenliste.",
        },
      },
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
  {
    name: "get_market_overview",
    description:
      "Liefert die bei finara geführten Marktindizes (DAX, MDAX, S&P 500, Nasdaq 100) mit aktuellem Stand und Tagesveränderung — ausschließlich Simulationsdaten, da Index-Level-Live-Kurse bei keinem angebundenen Free-Tier-Anbieter verfügbar sind. Bei übergeordneten Markttrend-Anfragen OHNE konkretes Einzelinstrument aufrufen (Marktvolatilität, Indexbewegungen, allgemeine Marktlage, Markttreiber). Liefert KEINE VIX-/Volatilitätsindex-, Sektor-Performance- oder Forex-/Währungspaar-Daten — diese Datenquellen sind bei finara aktuell nicht angebunden; wird danach gefragt, das ehrlich benennen statt zu schätzen oder zu erfinden.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_news",
    description:
      "Liefert echte, über die Marktdaten-Anbindung abgerufene Nachrichten — mit symbol Nachrichten zu einem konkreten Instrument, ohne symbol allgemeine Marktnachrichten. Bei jeder Nachrichtenanfrage aufrufen, niemals eine Nachricht oder Quelle aus eigenem Wissen erfinden.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Optional: Instrumenten-Symbol für instrumentenbezogene News. Ohne Angabe: allgemeine Marktnachrichten." },
      },
    },
  },
  {
    name: "get_watchlist",
    description:
      "Liefert die vom Nutzer angelegte Watchlist mit aktuellem Kurs, Tages-/30-Tage-Veränderung, Volatilität und Sektor je Instrument. Bei jeder Anfrage zu 'meiner Watchlist' aufrufen. Sektor stammt aus Financial Modeling Prep und ist NUR für Aktienpositionen verfügbar — bei ETFs/Kryptowährungen oder fehlender Datenabdeckung steht dort 'nicht zutreffend'/'nicht verfügbar', das unverändert übernehmen statt zu raten.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_fundamentals",
    description:
      "Liefert echte Fundamentaldaten für ein Instrument (KGV, PEG-Verhältnis, KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS, Marktkapitalisierung, Sektor, sowie Analysten-Konsensschätzungen für Umsatz/EPS der kommenden Geschäftsjahre für Wachstumsfragen), abgerufen über Financial Modeling Prep. Die vollständigen Kennzahlen (KGV/PEG/KUV/Verschuldungsgrad/Dividendenrendite/Cashflow/EPS/Analystenschätzungen) sind NUR für die verifiziert abgedeckten Symbole verfügbar (aktuell: NVDA, MSFT, TSLA). Für andere AKTIEN-Symbole (z. B. SAP, ASML) liefert das Tool trotzdem found:true mit limitedCoverage:true — dann sind nur sector und marketCap gesetzt, alle übrigen Kennzahlen stehen explizit auf 'nicht verfügbar' (message erklärt warum). Für Krypto/ETFs liefert das Tool found:false, da diese Kennzahlen dort konzeptionell nicht gelten. Bei jeder Frage zu KGV/PEG/KUV/Verschuldungsgrad/Dividendenrendite/Cashflow/EPS/Marktkapitalisierung/Sektor/Umsatz- oder Gewinnwachstum dieses Tool aufrufen, nie einen dieser Werte aus eigenem Wissen nennen. Ein einzelner, im Ergebnis explizit als \"nicht verfügbar\" markierter Wert ist genauso zu behandeln — nie als 0 interpretieren oder schätzen.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. NVDA." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_intraday_technicals",
    description:
      "Liefert echte Multi-Timeframe-Intraday-Indikatoren (RSI, MACD-Histogramm, ADX, Stochastik-%K, daraus abgeleitetes Signal) für ein Instrument über mehrere kurze Zeitrahmen (Standard: 1min/5min/15min). NUR für Instrumente mit echter Live-Intraday-Anbindung verfügbar (aktuell: SAP, NVDA, MSFT, TSLA, ASML, BTC, ETH, SOL) — für alle anderen Symbole liefert das Tool jeden Zeitrahmen explizit als 'nicht verfügbar' (available:false mit unavailableReason), NIEMALS einen aus Tagesdaten geschätzten Intraday-Wert. Bei Kurzfrist-/Daytrading-Vergleichsanfragen aufrufen (siehe die entsprechende System-Prompt-Regel), nicht bei normalen Score-/Trend-Anfragen — dafür bleibt get_analysis zuständig.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. TSLA." },
        timeframes: {
          type: "array",
          items: { type: "string", enum: ["1m", "5m", "15m"] },
          description: "Optional: welche Zeitrahmen abgerufen werden sollen. Ohne Angabe: alle drei (1m, 5m, 15m).",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_market_status",
    description:
      "Liefert den aktuellen Handelsstatus einer Börse (offen/geschlossen/vorbörslich/nachbörslich/24-7 bei Krypto) inklusive Minuten bis zur nächsten Öffnung/Schließung — serverseitig aus der aktuellen Uhrzeit berechnet, kein geschätzter Wert. Bei jeder Kurzfrist-/Daytrading-Anfrage (Handel innerhalb von Minuten/Stunden) IMMER zuerst aufrufen und das Ergebnis prominent an den Anfang der Antwort stellen, bevor die eigentliche Analyse folgt — insbesondere wenn der Markt bald schließt oder bereits geschlossen ist. Keine Feiertagskalender-Daten angebunden (holidaysNotModeled:true im Ergebnis) — ein Handelsfeiertag an einem Werktag wird fälschlich als 'offen' gemeldet, das ist eine bekannte Einschränkung, nicht zu verschweigen, falls danach gefragt wird.",
    input_schema: {
      type: "object",
      properties: {
        exchange: {
          type: "string",
          enum: ["US", "XETRA", "CRYPTO"],
          description:
            "Welche Börse geprüft werden soll. Alle bei finara live angebundenen Aktien (SAP, NVDA, MSFT, TSLA, ASML) notieren als US-Kurse (siehe lib/market-data/symbols.ts) -> \"US\" verwenden, nicht \"XETRA\", auch für SAP. \"CRYPTO\" für BTC/ETH/SOL (24/7, kein Handelsschluss).",
        },
      },
      required: ["exchange"],
    },
  },
  {
    name: "get_stock_report_data",
    description:
      "Bündelt ALLE Bausteine für den Standard-Analysebericht (present_stock_report) in einem Aufruf: Kurs-/Performance-Kennzahlen (1W/1M/3M/YTD/1J), Multi-Horizont-Technik (1h/Tageschart/Wochenchart inkl. Widerspruchs-Hinweis, falls die Zeitebenen divergieren), Margen-/Umsatztrend über mehrere Jahre, Bilanz-Kurzcheck (Current Ratio, Eigenkapitalrendite, FCF-Rendite), letztes Earnings-Ergebnis (EPS Ist/Erwartung), News und Analysten-Konsens (Buy/Hold/Sell-Zahlen). NUR für eine einfache 'Analysiere [Instrument]'-Anfrage aufrufen (siehe die entsprechende System-Prompt-Regel zur Abgrenzung von Score-Analyse/Tiefenanalyse) — für Fundamentaldaten-Teilfragen weiterhin get_fundamentals, für reine Score-Anfragen weiterhin get_analysis nutzen. Margen-/Bilanz-/Earnings-Felder sind NUR für die FMP-Fundamentaldaten-Abdeckung (aktuell NVDA/MSFT/TSLA) verfügbar — für alle anderen Symbole stehen sie explizit auf 'nicht verfügbar', niemals schätzen. nextEarningsDate und consensusRevisionTrend sind bei finara aktuell grundsätzlich nicht angebunden (keine Kalender-/Revisionsdaten-Quelle) — das ehrlich als 'nicht verfügbar' übernehmen, nicht verschweigen.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. TSLA." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "screen_momentum_candidates",
    description:
      "Screent NICHT den Gesamtmarkt, sondern eine vorgefilterte Teilmenge der bei finara live angebundenen Instrumente (aktuell 8 Symbole: SAP, NVDA, MSFT, TSLA, ASML, BTC, ETH, SOL) nach Tagesperformance über minChangePct, RSI zwischen 50 und 80 (Momentum vorhanden, noch nicht extrem überkauft) und Mindestvolumen. Sortiert absteigend nach Tagesperformance, liefert die Top `limit` Kandidaten. Das Ergebnis ist explizit als vorgefilterte Teilmenge gekennzeichnet (scopeNote/candidatesTotal, wie bei get_ranking) — bei einer Daytrading-Screener-Anfrage über mehrere Instrumente OHNE Watchlist-Bezug aufrufen, NIE als marktweiten Screen über alle US-Aktien darstellen und nie Kandidaten außerhalb dieser Liste erfinden.",
    input_schema: {
      type: "object",
      properties: {
        minChangePct: { type: "number", description: "Mindest-Tagesperformance in Prozent. Ohne Angabe: 2." },
        limit: { type: "number", description: "Wie viele Top-Kandidaten zurückgegeben werden sollen. Ohne Angabe: 3." },
      },
    },
  },
  {
    name: "calculate_pivot_points",
    description:
      "Berechnet klassische Pivot-Points (Pivot, R1-R3, S1-S3) aus der letzten vollständigen Handelsperiode eines Instruments — reine Mathematik aus High/Low/Close, kein separater Datenanbieter. Für Instrumente mit echter Live-Kursanbindung basiert die Berechnung auf echten OHLC-Daten (dataSource:'live'); für alle anderen Instrumente werden High/Low aus dem simulierten Schlusskurs angenähert (dataSource:'simulated', klar als Näherung gekennzeichnet, keine echten Intraday-Extremwerte). Bei Kurzfrist-/Daytrading-Anfragen nach konkreten Unterstützungs-/Widerstandsniveaus aufrufen.",
    input_schema: {
      type: "object",
      properties: {
        symbol: { type: "string", description: "Instrumenten-Symbol, z. B. TSLA." },
        timeframe: { type: "string", enum: ["1D", "1W"], description: "Ohne Angabe: '1D' (Tages-Pivots aus der letzten vollständigen Handelssitzung)." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "export_analysis",
    description:
      "Exportiert die zuletzt im Gespräch erstellte Analyse zu einem Instrument als Datei (CSV, Word oder PowerPoint). Nur aufrufen, wenn der Nutzer explizit per Chat-Nachricht um einen Export/Download bittet (z. B. 'gib mir das als CSV', 'als Word-Dokument bitte', 'kannst du eine Präsentation daraus machen'). instrument MUSS das Symbol sein, auf das sich der Export bezieht — ist aus dem Gesprächsverlauf nicht eindeutig, WELCHES Instrument gemeint ist, vorher kurz nachfragen statt zu raten. format MUSS eines von csv/docx/pptx sein — ist das gewünschte Format aus der Nutzer-Formulierung nicht eindeutig (z. B. nur 'exportier das'), vorher kurz nachfragen ('Als CSV, Word-Dokument oder PowerPoint-Präsentation?') statt zu raten oder ein anderes Format wie PDF/Excel zu versprechen (nur diese drei werden unterstützt). Liefert bei Erfolg direkt die fertige Datei zum Download — schreibe danach KEINEN zusätzlichen Fließtext, der die Analyse erneut ausgibt. Liefert exported:false, wenn keine passende Analyse gefunden wurde — dann im Chat ehrlich sagen, dass zuerst eine Analyse zu diesem Instrument erstellt werden muss (z. B. per Score-/SWOT-/Markteinschätzungs-Anfrage), statt eine Datei zu behaupten.",
    input_schema: {
      type: "object",
      properties: {
        instrument: { type: "string", description: "Symbol des Instruments, dessen letzte Analyse exportiert werden soll." },
        format: { type: "string", enum: ["csv", "docx", "pptx"] },
      },
      required: ["instrument", "format"],
    },
  },
];

/** Reused verbatim on every present_*-tool below via spreadable object literals — Punkt 7's
 *  generic "optionale, vorformulierte Folgefrage" mechanism. A single shared field definition
 *  instead of retyping the same description on 10+ tools; components/chat/structuredMessage.ts's
 *  parseSuggestedFollowUp() reads it generically off whichever card type the model returned. */
const SUGGESTED_FOLLOW_UP_PROPERTY = {
  suggestedFollowUp: {
    type: "string" as const,
    description:
      "Optional: EINE vorformulierte, anklickbare Folgefrage, die als nächste Nutzer-Nachricht verschickt würde (z. B. 'Volumendaten von X genauer analysieren?'). Nur setzen, wenn eine naheliegende, sinnvolle Vertiefung existiert — nicht bei jeder Antwort erzwingen, meistens weglassen.",
  },
};

/**
 * Not a data-fetching tool: this is the structured-output channel. Call it as the FINAL
 * response for an instrument/chart-focused technical read instead of writing free text, so the
 * UI can render a consistent Trend/Support-Resistance/Risiko card instead of a prose bubble.
 */
export const marketAnalysisTool: Anthropic.Tool = {
  name: "present_market_analysis",
  description:
    "Gibt eine strukturierte Markteinschätzung zu einem einzelnen Instrument zurück (Trend, Unterstützung/Widerstand, Risiko-Einschätzung, Bull/Base/Bear Case, Fazit). Nur aufrufen, wenn eine chart-/instrumentenbezogene technische Einschätzung gefragt ist — nicht für Portfolio-, Glossar- oder allgemeine Fragen. Muss nach get_instrument UND get_analysis aufgerufen werden, damit Kurs, Score und Strategie-Werte korrekt sind.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string", description: "Instrumenten-Symbol, das analysiert wird." },
      trend: {
        type: "string",
        description:
          "Kurze Trend-Einschätzung (z. B. Aufwärtstrend, Seitwärtsbewegung, Abwärtstrend) mit knapper Begründung, gestützt auf changePercent1d/30d aus get_instrument und den Momentum-Faktoren aus get_analysis.",
      },
      supportResistance: {
        type: "string",
        description:
          "Visuelle Einschätzung möglicher Unterstützungs-/Widerstandszonen basierend auf dem Kursverlauf bzw. dem beigefügten Chart-Bild. Explizit als Schätzung kennzeichnen ('visuelle Einschätzung, keine exakte Kennzahl'), nicht als verifizierte Zahl darstellen.",
      },
      riskAssessment: {
        type: "string",
        description: "Risiko-Einschätzung im Chance/Risiko-Framing, gestützt auf den Risk-Score und dessen Faktoren aus get_analysis, ohne Renditeversprechen.",
      },
      bullCase: {
        type: "string",
        description:
          "Was für ein positives Szenario spricht, basierend auf den tatsächlichen Momentum-/Strategie-Werten aus get_analysis (z. B. welche Faktoren aktuell für Stärke sprechen und was anhalten müsste). KEIN Kursziel, KEINE Renditeangabe, kein 'wird steigen' — Chancen/Risiko-Framing wie überall sonst.",
      },
      baseCase: {
        type: "string",
        description: "Das wahrscheinlichste Szenario, wenn sich die aktuellen, in get_analysis sichtbaren Trends fortsetzen — neutral formuliert, keine Prognose als Fakt dargestellt.",
      },
      bearCase: {
        type: "string",
        description:
          "Was gegen die These spricht bzw. sie kippen würde — konkrete Risiken aus den Risk-Score-Faktoren und ggf. schwächeren Strategie-Werten aus get_analysis, nicht generische Floskeln.",
      },
      summary: { type: "string", description: "Fazit in 1-2 Sätzen, endet inhaltlich darauf, dass die Entscheidung beim Nutzer liegt." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "trend", "supportResistance", "riskAssessment", "bullCase", "baseCase", "bearCase", "summary"],
  },
};

/**
 * Structured-output channel for a single-instrument Score-/Wahrscheinlichkeits-Anfrage (e.g.
 * "Sollte ich X heute kaufen?"), as opposed to present_market_analysis's narrative trend/Bull-
 * Base-Bear card — different request type, different shape (indicator table + weighted factors +
 * one overall number), so a separate tool/card instead of overloading present_market_analysis.
 */
export const scoreAnalysisTool: Anthropic.Tool = {
  name: "present_score_analysis",
  description:
    "Gibt eine strukturierte Score-Analyse für EIN Instrument zurück (technische Indikatoren-Tabelle, gewichtete Faktoren, Gesamtscore, Konfidenz). Nur bei einer expliziten Score-/Wahrscheinlichkeits-Anfrage aufrufen (z. B. 'Sollte ich X heute kaufen?', 'Wie steht der Score von X?') — für allgemeine Trend-/Chart-Einschätzungen weiterhin present_market_analysis nutzen, nicht dieses Tool. Muss nach get_instrument UND get_analysis aufgerufen werden; jede Zahl hier MUSS 1:1 aus deren Ergebnis stammen, nie selbst geschätzt oder gerundet-erfunden werden. Für jeden nicht verfügbaren Faktor: score/value weglassen und stattdessen im note-Feld die unavailableReason aus get_analysis nennen.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      instrumentType: { type: "string", description: "Erkannter Instrumententyp, z. B. Aktie, Kryptowährung, ETF." },
      technicalIndicators: {
        type: "array",
        description: "Die 6 Einzel-Indikatoren aus get_analysis's technical-Score-Faktoren.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            signal: { type: "string", enum: ["bullisch", "neutral", "bärisch", "nicht verfügbar"] },
          },
          required: ["label", "value", "signal"],
        },
      },
      technicalSubscore: { type: "number", description: "get_analysis's technical-Score (0-100). Weglassen, wenn unavailable." },
      factors: {
        type: "array",
        description: "Die Hauptfaktoren (technical, volume, sentiment, analystConsensus, marketEnvironment) mit ihrer tatsächlichen Gewichtung aus der Intraday-Strategie.",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            score: { type: "number", description: "0-100. Weglassen, wenn unavailable." },
            weightPercent: { type: "number", description: "Tatsächlich verwendetes (renormiertes) Gewicht in Prozent." },
            note: { type: "string", description: "Kurze Begründung, oder bei unavailable die unavailableReason." },
          },
          required: ["label", "weightPercent", "note"],
        },
      },
      overallScore: { type: "number", description: "compositeScore der Intraday-Strategie aus get_analysis. Weglassen, wenn unavailable." },
      confidence: { type: "string", enum: ["niedrig", "mittel", "hoch"] },
      missingDataNote: { type: "string", description: "Zusammenfassung, welche Faktoren fehlten und was ein Tarif-Upgrade ergänzen würde." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "instrumentType", "technicalIndicators", "factors", "confidence"],
  },
};

/** Structured-output channel for a Ranking-Anfrage — same trust model as present_market_analysis
 *  (Claude carries the numbers over from the immediately preceding get_ranking result). */
export const rankingTool: Anthropic.Tool = {
  name: "present_ranking",
  description:
    "Gibt ein strukturiertes Score-Ranking über eine Kandidatenliste zurück. Nur nach get_ranking aufrufen, alle Zahlen 1:1 aus dessen Ergebnis übernehmen. Ausschließlich neutrale, beschreibende Sprache in driver ('zeigt aktuell den höchsten Score', 'die Daten deuten auf...') — NIEMALS 'ich empfehle', 'gute Kaufgelegenheit', 'greif zu', 'das lohnt sich' oder ähnliche Kaufaufforderungen.",
  input_schema: {
    type: "object",
    properties: {
      period: { type: "string", description: "Vom Nutzer genannter oder implizierter Zeitraum, z. B. 'heute', 'diese Woche'." },
      candidatesTotal: { type: "number", description: "get_ranking's candidatesTotal." },
      scopeNote: { type: "string", description: "get_ranking's scopeNote — Hinweis auf die vorgefilterte Teilmenge." },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rank: { type: "number" },
            symbol: { type: "string" },
            name: { type: "string" },
            assetClass: { type: "string" },
            compositeScore: { type: "number" },
            driver: { type: "string", description: "1-2 Sätze neutrale Begründung anhand des stärksten Einzelfaktors." },
          },
          required: ["rank", "symbol", "name", "assetClass", "compositeScore", "driver"],
        },
      },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["period", "candidatesTotal", "scopeNote", "rows"],
  },
};

/** Structured-output channel for a SWOT-Anfrage — 2x2-Karte statt vier Fließtext-Absätze, damit
 *  die vier Kategorien auf einen Blick unterscheidbar bleiben. */
export const swotAnalysisTool: Anthropic.Tool = {
  name: "present_swot_analysis",
  description:
    "Gibt eine strukturierte SWOT-Analyse für EIN Instrument als 2x2-Karte zurück (Stärken, Schwächen, Chancen, Risiken). Nur bei einer expliziten SWOT-Anfrage aufrufen, nach get_instrument UND get_analysis. Jeder Punkt kurz (max. 1 Satz) und konkret aus den Tool-Daten abgeleitet, keine Allgemeinplätze. Statt eines Fließtexts in vier Absätzen aufrufen — die Karte macht die vier Kategorien auf einen Blick unterscheidbar.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      strengths: { type: "array", items: { type: "string" }, description: "2-4 konkrete Stärken, aus Momentum-/Technisch-Faktoren." },
      weaknesses: { type: "array", items: { type: "string" }, description: "2-4 konkrete Schwächen, aus Momentum-/Technisch-/Risiko-Faktoren." },
      opportunities: { type: "array", items: { type: "string" }, description: "2-4 konkrete Chancen, aus Sentiment-/Analystenkonsens-Faktoren." },
      risks: { type: "array", items: { type: "string" }, description: "2-4 konkrete Risiken, aus Risk-Score-Faktoren und ehrlich benannten Datenlücken." },
      summary: { type: "string", description: "1 Satz Fazit, endet inhaltlich mit dem Pflicht-Disclaimer-Hinweis." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "strengths", "weaknesses", "opportunities", "risks", "summary"],
  },
};

/** Structured-output channel for eine Bullen-vs-Bären-Anfrage — zwei farblich getrennte Spalten
 *  statt eines langen Fließtexts, in dem sich bullish/bearish schnell vermischen. */
export const bullBearAnalysisTool: Anthropic.Tool = {
  name: "present_bull_bear_analysis",
  description:
    "Gibt eine strukturierte Bullen-vs-Bären-Analyse für EIN Instrument als zwei farblich getrennte Spalten zurück. Nur bei einer expliziten Bullen-vs-Bären-Anfrage aufrufen, nach get_instrument UND get_analysis. Jeder Punkt mit einer Zahl/einem Faktor aus den Tool-Ergebnissen belegt. conclusion ist neutral, würdigt beide Seiten, OHNE eigene Tendenz oder Kaufempfehlung.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      bullPoints: { type: "array", items: { type: "string" }, description: "3-4 bullishe Argumente, mit Faktor/Zahl belegt." },
      bearPoints: { type: "array", items: { type: "string" }, description: "3-4 bearishe Argumente, mit Faktor/Zahl belegt." },
      conclusion: { type: "string", description: "Neutrales Fazit, würdigt beide Seiten, endet inhaltlich mit dem Pflicht-Disclaimer-Hinweis." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "bullPoints", "bearPoints", "conclusion"],
  },
};

/** Structured-output channel für Markttrend-Anfragen — echte Tabellenzeilen statt einer
 *  Markdown-Tabelle im Fließtext (der Chat rendert kein Markdown, siehe present_score_analysis). */
export const marketOverviewTool: Anthropic.Tool = {
  name: "present_market_overview",
  description:
    "Gibt eine strukturierte Marktübersicht zurück (Index-Tabelle + kurze Einordnung). Nur nach get_market_overview aufrufen, alle Index-Werte 1:1 aus dessen Ergebnis übernehmen. Für Datenpunkte, nach denen gefragt wurde, aber die get_market_overview nicht liefert (VIX, Sektor-Performance, Forex), diese explizit in unavailable auflisten statt sie zu schätzen.",
  input_schema: {
    type: "object",
    properties: {
      indices: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            name: { type: "string" },
            value: { type: "string" },
            changePercent1d: { type: "string" },
          },
          required: ["symbol", "name", "value", "changePercent1d"],
        },
      },
      insight: { type: "string", description: "2-4 Sätze Einordnung der Zahlen, mit konkreten Werten belegt." },
      unavailable: {
        type: "array",
        items: { type: "string" },
        description: "Datenpunkte aus der Nutzerfrage, die finara aktuell NICHT liefert (z. B. 'VIX/Volatilitätsindex', 'Sektor-Performance', 'Forex-/Währungspaare'). Leer lassen, wenn nichts davon gefragt war.",
      },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["indices", "insight"],
  },
};

/** Structured-output channel für Nachrichtenanfragen — kompakte Listenzeilen statt eines langen
 *  Fließtext-Absatzes, in dem einzelne Meldungen schwer auseinanderzuhalten sind. */
export const newsSummaryTool: Anthropic.Tool = {
  name: "present_news_summary",
  description:
    "Gibt eine strukturierte Nachrichten-Zusammenfassung zurück (3-5 Meldungen als Liste). Nur nach get_news aufrufen, title/source/publishedAt 1:1 aus dessen Ergebnis übernehmen. relevance ist deine kurze Einschätzung der möglichen Marktrelevanz (1 Satz), keine erfundene Zahl.",
  input_schema: {
    type: "object",
    properties: {
      scope: { type: "string", description: "get_news's scope, z. B. 'Nachrichten zu SAP' oder 'Allgemeine Marktnachrichten'." },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            source: { type: "string" },
            publishedAt: { type: "string" },
            relevance: { type: "string", description: "1 Satz: mögliche Marktrelevanz." },
          },
          required: ["title", "source", "publishedAt", "relevance"],
        },
      },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["scope", "items"],
  },
};

/** Structured-output channel für qualitative Watchlist-Anfragen (Risiko/Sektor/Chance-Risiko) —
 *  Positionstabelle statt Fließtext, damit einzelne Werte auf einen Blick vergleichbar bleiben.
 *  Für Score-/Ranking-Anfragen zur Watchlist weiterhin present_ranking nutzen, nicht dieses Tool. */
export const watchlistOverviewTool: Anthropic.Tool = {
  name: "present_watchlist_overview",
  description:
    "Gibt eine strukturierte Watchlist-Übersicht zurück (Positionstabelle + Einordnung). Nur nach get_watchlist aufrufen, alle Positionswerte 1:1 aus dessen Ergebnis übernehmen. Für Score-/Ranking-Anfragen zur Watchlist NICHT dieses Tool nutzen, sondern present_ranking nach get_ranking(watchlistOnly=true).",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            name: { type: "string" },
            price: { type: "string" },
            changePercent1d: { type: "string" },
            changePercent30d: { type: "string" },
            volatility: { type: "string" },
            dataSource: { type: "string", enum: ["live", "simulated"] },
          },
          required: ["symbol", "name", "price", "changePercent1d", "changePercent30d", "volatility", "dataSource"],
        },
      },
      insight: { type: "string", description: "2-5 Sätze Einordnung (Konzentration, Volatilität, Chance-Risiko o. Ä.), je nach Nutzerfrage." },
      dataGaps: { type: "string", description: "Ehrlicher Hinweis auf fehlende Datenquellen, wenn danach gefragt wurde (z. B. Sektorzugehörigkeit)." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["items", "insight"],
  },
};

/** Structured-output channel für Fundamentaldaten-Anfragen — Kennzahl/Wert/Einordnung-Tabelle
 *  statt Fließtext, analog zu present_market_overview. Nur nach get_fundamentals aufrufen, alle
 *  Werte 1:1 aus dessen Ergebnis übernehmen; "nicht verfügbar"-Werte unverändert übernehmen statt
 *  wegzulassen, damit die Datenlücke für den Nutzer sichtbar bleibt. */
export const fundamentalsAnalysisTool: Anthropic.Tool = {
  name: "present_fundamentals_analysis",
  description:
    "Gibt eine strukturierte Fundamentaldaten-Analyse für EIN Instrument als Kennzahl-Tabelle zurück (Kennzahl | Wert | Einordnung). Nur nach einem erfolgreichen get_fundamentals-Aufruf (found:true) verwenden, alle Werte 1:1 aus dessen Ergebnis übernehmen. Einordnung ist deine kurze qualitative Einschätzung des jeweiligen Werts (1 Satz, z. B. 'im Vergleich zum Sektor moderat bewertet') — bei einem Wert 'nicht verfügbar' dort ebenfalls 'nicht verfügbar' oder eine kurze Begründung eintragen, nie einen Wert erfinden, um die Zeile zu füllen.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      sector: { type: "string" },
      rows: {
        type: "array",
        description: "Eine Zeile je Kennzahl (KGV, PEG, KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS, Marktkapitalisierung).",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            note: { type: "string", description: "1 Satz Einordnung, oder 'nicht verfügbar' bei fehlendem Wert." },
          },
          required: ["label", "value", "note"],
        },
      },
      growthOutlook: { type: "string", description: "1-2 Sätze zur Umsatz-/Gewinnentwicklung anhand der Analysten-Konsensschätzungen aus get_fundamentals, falls vorhanden — sonst weglassen statt zu spekulieren." },
      summary: { type: "string", description: "Fazit in 1-2 Sätzen, endet inhaltlich mit dem Pflicht-Disclaimer-Hinweis." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "rows", "summary"],
  },
};

/**
 * Structured-output channel for "in X Minuten investieren und in Y Minuten wieder verkaufen,
 * welche Aktie?"-style requests — combines present_score_analysis (embedded per candidate, reused
 * as-is rather than reinvented) with a multi-timeframe indicator table, market-timing banner,
 * pro/contra lists and a verdict paragraph. Candidates come from get_watchlist when the user names
 * no ticker (see the system prompt's KURZFRIST-VERGLEICHSANALYSE rule) — this tool itself doesn't
 * fetch anything, it only structures numbers the model already pulled via get_watchlist/
 * get_analysis/get_intraday_technicals/get_market_status, same trust model as every other
 * present_*-tool.
 */
export const shortTermComparisonTool: Anthropic.Tool = {
  name: "present_shortterm_comparison",
  description:
    "Gibt einen strukturierten Kurzfrist-Vergleich mehrerer Instrumente zurück (Markt-Timing-Hinweis, Multi-Timeframe-Indikator-Tabelle je Kandidat, eingebettete Score-Analyse je Kandidat, Pro/Contra-Liste je Kandidat, Fazit). Nur bei einer expliziten Kurzfrist-Vergleichsanfrage aufrufen ('in X Minuten investieren', 'welches kurzfristige Signal ist stärker' o. Ä.), nach get_market_status, get_watchlist (falls kein Ticker genannt wurde), get_analysis UND get_intraday_technicals für jeden Kandidaten. AUSSCHLIESSLICH neutrale, datenbasierte Formulierungen in verdict und den pro/con-Punkten (z. B. 'zeigt das stärkere kurzfristige Signal') — NIEMALS 'ist die klar bessere Wahl', 'sollten Sie kaufen', 'ich empfehle' oder ähnliche direkte Wertungen, auch wenn die Datenlage eindeutig für einen Kandidaten spricht.",
  input_schema: {
    type: "object",
    properties: {
      marketTiming: {
        type: "object",
        description: "1:1 aus get_market_status übernommen. Bei status 'closed' oder minutesToNextChange < 30 im geöffneten Zustand MUSS dieser Hinweis prominent vor der eigentlichen Analyse stehen.",
        properties: {
          exchange: { type: "string" },
          status: { type: "string" },
          minutesToNextChange: { type: "number" },
          nextChangeLabel: { type: "string" },
        },
        required: ["exchange", "status"],
      },
      candidates: {
        type: "array",
        description: "Ein Eintrag je verglichenem Instrument (typischerweise 2-3, aus der Watchlist oder den genannten Tickern).",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            name: { type: "string" },
            technicalsByTimeframe: {
              type: "array",
              description: "1:1 aus get_intraday_technicals.timeframes übernommen (timeframe, available, rsi, macdHistogram, adx, stochasticK, signal).",
              items: {
                type: "object",
                properties: {
                  timeframe: { type: "string", enum: ["1m", "5m", "15m"] },
                  available: { type: "boolean" },
                  unavailableReason: { type: "string" },
                  rsi: { type: "number" },
                  macdHistogram: { type: "number" },
                  adx: { type: "number" },
                  stochasticK: { type: "number" },
                  signal: { type: "string", enum: ["bullisch", "neutral", "bärisch", "nicht verfügbar"] },
                },
                required: ["timeframe", "available", "signal"],
              },
            },
            scoreAnalysis: {
              type: "object",
              description: "Exakt dieselbe Feldstruktur wie present_score_analysis (technicalIndicators, factors, overallScore, confidence usw.), aus demselben get_analysis-Aufruf für dieses Symbol — wird als eingebettete Score-Karte gerendert, nicht neu berechnet.",
            },
            pros: { type: "array", items: { type: "string" }, description: "2-4 Punkte, aus den tatsächlichen Tool-Daten abgeleitet." },
            cons: { type: "array", items: { type: "string" }, description: "2-4 Punkte, aus den tatsächlichen Tool-Daten abgeleitet." },
          },
          required: ["symbol", "name", "technicalsByTimeframe", "scoreAnalysis", "pros", "cons"],
        },
      },
      verdict: {
        type: "string",
        description: "3-5 Sätze, führt Tabelle + Score + Pro/Contra zusammen. Ausschließlich neutrale Formulierungen (siehe Tool-Beschreibung), endet mit dem Pflicht-Disclaimer-Hinweis.",
      },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["candidates", "verdict"],
  },
};

/**
 * Structured-output channel for "3 Top-Aktien für X Minuten"-style marktweite Screener-Anfragen
 * (über screen_momentum_candidates, nicht die Watchlist — present_shortterm_comparison bleibt für
 * Watchlist-basierte Kurzfrist-Vergleiche zuständig). The risk-management checklist and the
 * day-trading-specific disclaimer sentence are NOT model-supplied fields — they're rendered
 * statically by DaytradingScreenerCard.tsx itself so they can never be omitted or shortened by a
 * given tool call, per the product requirement that this checklist is mandatory on every
 * response of this type.
 */
export const daytradingScreenerTool: Anthropic.Tool = {
  name: "present_daytrading_screener",
  description:
    "Gibt einen strukturierten Daytrading-Kandidaten-Screener zurück (Markt-Status-Banner, Übersichtstabelle, pro Kandidat Stärken/Warnsignale/Pivot-Levels). Nur nach get_market_status, screen_momentum_candidates UND calculate_pivot_points (je Top-Kandidat) aufrufen. AUSSCHLIESSLICH neutrale, datenbasierte Formulierungen in strengths/warnings — NIEMALS direkte Kaufaufforderungen. Bei erkennbaren Anfängersignalen ('ich will Daytrader werden' o. Ä.) beginnerWarning setzen (siehe System-Prompt-Regel) — sonst weglassen.",
  input_schema: {
    type: "object",
    properties: {
      beginnerWarning: {
        type: "string",
        description: "Nur setzen, wenn die Anfrage erkennbare Anfängersignale zeigt: kurzer, sachlicher Hinweis auf die überdurchschnittlich hohen Verlustquoten beim Daytrading. Sonst weglassen.",
      },
      marketTiming: {
        type: "object",
        description: "1:1 aus get_market_status übernommen, plus ein Hinweis, ob die gezeigten Kurse Schlusskurse oder Live-Daten sind.",
        properties: {
          exchange: { type: "string" },
          status: { type: "string" },
          minutesToNextChange: { type: "number" },
          nextChangeLabel: { type: "string" },
          dataFreshnessNote: { type: "string", description: "z. B. 'Live-Kurse' oder 'Schlusskurse vom letzten Handelstag, Markt aktuell geschlossen'." },
        },
        required: ["exchange", "status", "dataFreshnessNote"],
      },
      screenerScopeNote: { type: "string", description: "1:1 aus screen_momentum_candidates.scopeNote — Hinweis auf die vorgefilterte Teilmenge." },
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            name: { type: "string" },
            price: { type: "string" },
            changePercent1d: { type: "string" },
            rsi: { type: "string" },
            technicalSignal: { type: "string", enum: ["bullisch", "neutral", "bärisch", "nicht verfügbar"] },
            beta: { type: "string", description: "'nicht verfügbar' — finara hat aktuell keine Beta-Datenquelle angebunden, niemals schätzen." },
            strengths: { type: "array", items: { type: "string" }, description: "2-3 Punkte, aus echten Tool-Daten abgeleitet." },
            warnings: { type: "array", items: { type: "string" }, description: "1-3 Punkte, z. B. 'RSI nahe überkauft', 'Signal auf höherem Zeitrahmen gegenläufig'." },
            pivotLevels: {
              type: "object",
              description: "1:1 aus calculate_pivot_points.levels für diesen Kandidaten.",
              properties: { pivot: { type: "number" }, r1: { type: "number" }, s1: { type: "number" } },
            },
          },
          required: ["symbol", "name", "price", "changePercent1d", "rsi", "technicalSignal", "beta", "strengths", "warnings"],
        },
      },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["marketTiming", "screenerScopeNote", "candidates"],
  },
};

/**
 * Structured-output channel for the Standard-Analysebericht ("analysiere mir TSLA Aktie") — a
 * mid-length report combining performance, multi-horizon technicals, fundamentals/margins,
 * earnings, news, and analyst consensus into one card. Only after get_stock_report_data — every
 * field here is 1:1 from that single aggregated call, same trust model as every other
 * present_*-tool. Deliberately a separate tool from present_score_analysis (single-score card) and
 * the 18-Punkte-Tiefenanalyse-Fließtext-Report (explicit deep-dive) — see the system prompt's
 * Abgrenzungsregel for when each applies.
 */
export const stockReportTool: Anthropic.Tool = {
  name: "present_stock_report",
  description:
    "Gibt den Standard-Analysebericht für EIN Instrument zurück (Einleitung, Performance-Tabelle, Multi-Horizont-Technik, Margen-Trend, Bilanz-Kurzcheck, letztes Earnings-Ergebnis, News, Analysten-Konsens, Bull/Bear Case, Fazit). Nur nach get_stock_report_data aufrufen, alle Werte 1:1 aus dessen Ergebnis übernehmen. 'nicht verfügbar'-Werte unverändert übernehmen, nie schätzen. AUSSCHLIESSLICH für eine einfache 'Analysiere [Instrument]'-Anfrage ohne Score-/Tiefenanalyse-spezifisches Vokabular aufrufen — siehe die System-Prompt-Abgrenzungsregel.",
  input_schema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
      intro: { type: "string", description: "1-2 prägnante Sätze mit den auffälligsten 2-3 Fakten (Kurs, Marktkap., wichtigste Spannung)." },
      keyMetrics: {
        type: "object",
        properties: {
          price: { type: "string" },
          marketCap: { type: "string" },
          peRatio: { type: "string" },
          pegRatio: { type: "string" },
          beta: { type: "string" },
          rsi: { type: "string" },
        },
        required: ["price", "marketCap", "peRatio", "pegRatio", "beta", "rsi"],
      },
      performance: {
        type: "array",
        description: "1:1 aus get_stock_report_data.performance.",
        items: {
          type: "object",
          properties: { window: { type: "string" }, changePercent: { type: "number" }, unavailableReason: { type: "string" } },
          required: ["window"],
        },
      },
      technicalHorizons: {
        type: "array",
        description: "1:1 aus get_stock_report_data.technicalHorizons.",
        items: {
          type: "object",
          properties: { label: { type: "string" }, signal: { type: "string" }, note: { type: "string" } },
          required: ["label", "signal", "note"],
        },
      },
      divergenceNote: { type: "string", description: "1:1 aus get_stock_report_data.divergenceNote, falls vorhanden — Widerspruch zwischen Zeitebenen explizit benennen, nicht glätten." },
      fundamentalsCoverageNote: { type: "string" },
      margins: {
        type: "array",
        description: "1:1 aus get_stock_report_data.margins, falls verfügbar (sonst weglassen).",
        items: {
          type: "object",
          properties: {
            fiscalYear: { type: "string" },
            revenue: { type: "number" },
            grossMarginPct: { type: "number" },
            operatingMarginPct: { type: "number" },
            netMarginPct: { type: "number" },
          },
        },
      },
      marginTrendInsight: { type: "string", description: "1 Satz Einordnung des Margentrends, falls margins verfügbar." },
      balanceSheetCheck: {
        type: "object",
        properties: {
          currentRatio: { type: "string" },
          returnOnEquityPct: { type: "string" },
          freeCashFlowYieldPct: { type: "string" },
          debtToEquity: { type: "string" },
          cashPosition: { type: "string" },
        },
      },
      lastEarnings: { type: "string", description: "Kurzbeschreibung des letzten Earnings-Ergebnisses (EPS Ist/Erwartung, Überraschung) oder 'nicht verfügbar'." },
      nextEarningsDate: { type: "string", description: "1:1 'nicht verfügbar' aus get_stock_report_data — bei finara aktuell keine Kalenderquelle angebunden." },
      consensusRevisionTrend: { type: "string", description: "1:1 'nicht verfügbar' aus get_stock_report_data." },
      news: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, source: { type: "string" }, relevance: { type: "string" } },
          required: ["title", "source", "relevance"],
        },
      },
      analystConsensus: { type: "string", description: "Buy/Hold/Sell-Zahlen aus get_stock_report_data.analystCounts, oder 'nicht verfügbar'. Kursziel/Konsens-Upside sind bei finara nicht angebunden — falls danach gefragt, das ehrlich benennen statt zu erfinden." },
      bullPoints: { type: "array", items: { type: "string" }, description: "4-5 Punkte mit 🐂, aus echten Tool-Daten abgeleitet." },
      bearPoints: { type: "array", items: { type: "string" }, description: "4-5 Punkte mit 🐻, aus echten Tool-Daten abgeleitet." },
      summary: { type: "string", description: "4-6 Sätze Fazit, führt alles zusammen, endet mit dem Pflicht-Disclaimer-Hinweis." },
      ...SUGGESTED_FOLLOW_UP_PROPERTY,
    },
    required: ["symbol", "intro", "keyMetrics", "performance", "technicalHorizons", "bullPoints", "bearPoints", "summary"],
  },
};

export async function runFinanceTool(
  name: string,
  input: Record<string, unknown>,
  appUser: AppUser,
  positions: PortfolioPosition[],
  history: ChatMessage[],
): Promise<string> {
  switch (name) {
    case "get_portfolio_summary": {
      if (positions.length === 0) {
        return JSON.stringify({ hasPositions: false, message: "Der Nutzer hat noch keine Portfolio-Positionen hinterlegt." });
      }
      const analysis = analyzePortfolio(positions);
      const sectorAllocation = await computeSectorAllocation(positions);
      return JSON.stringify({
        hasPositions: true,
        totalValue: formatCurrency(analysis.totalValue),
        gainAbs: formatCurrency(analysis.gainAbs),
        gainPct: `${analysis.gainPct.toFixed(1)} %`,
        allocation: analysis.allocation.map((a) => ({
          assetClass: assetClassLabel[a.assetClass],
          percent: `${a.percent.toFixed(0)} %`,
        })),
        sectorAllocation: sectorAllocation.rows,
        sectorUnclassifiedNote: sectorAllocation.unclassifiedNote,
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
    case "get_analysis": {
      const symbol = String(input.symbol ?? "");
      const instrument = await getInstrument(symbol);
      if (!instrument) return JSON.stringify({ found: false, message: `Kein Instrument mit Symbol ${symbol} gefunden.` });

      const analysis = await computeAnalysisForInstrument(instrument);
      const strategies = applyAllStrategies(analysis);
      const defaultStrategy = resolveStrategyForUser(appUser);
      const requestedStrategyId = typeof input.strategyId === "string" ? input.strategyId : undefined;

      return JSON.stringify({
        found: true,
        symbol: instrument.symbol,
        dataSource: instrument.source,
        generatedAt: analysis.generatedAt,
        scores: analysis.scores,
        strategies,
        defaultStrategy: defaultStrategy.id,
        highlightedStrategy: requestedStrategyId ?? defaultStrategy.id,
        ...(wasTwelveDataRateLimitedRecently() ? { rateLimitNote: RATE_LIMIT_NOTE } : {}),
      });
    }
    case "get_ranking": {
      const strategyId = typeof input.strategyId === "string" ? input.strategyId : "intraday";
      const assetClassFilter = typeof input.assetClass === "string" ? (input.assetClass as Instrument["assetClass"]) : undefined;
      const watchlistOnly = input.watchlistOnly === true;
      const strategy = getStrategy(strategyId) ?? getStrategy("intraday")!;

      const allInstruments = await getAllInstruments();
      let candidates = assetClassFilter ? allInstruments.filter((i) => i.assetClass === assetClassFilter) : allInstruments;

      if (watchlistOnly) {
        const watchlist = await getWatchlist(appUser.id);
        if (watchlist.length === 0) {
          return JSON.stringify({ hasItems: false, message: "Der Nutzer hat noch keine Instrumente auf der Watchlist." });
        }
        const watchlistSymbols = new Set(watchlist.map((w) => w.symbol));
        candidates = candidates.filter((i) => watchlistSymbols.has(i.symbol));
      }

      const limit =
        typeof input.limit === "number" && input.limit > 0 ? Math.floor(input.limit) : watchlistOnly ? candidates.length : 3;

      const ranked = await Promise.all(
        candidates.map(async (instrument) => {
          const analysis = await computeAnalysisForInstrument(instrument);
          return { instrument, result: applyStrategy(analysis, strategy) };
        }),
      );

      const sorted = ranked
        .filter((r) => r.result.compositeScore !== null)
        .sort((a, b) => (b.result.compositeScore ?? 0) - (a.result.compositeScore ?? 0))
        .slice(0, limit);

      return JSON.stringify({
        strategyId: strategy.id,
        strategyLabel: strategy.label,
        candidatesTotal: candidates.length,
        scopeNote: watchlistOnly
          ? `Bewertung der Watchlist des Nutzers: ${candidates.length} Instrumente.`
          : `Vorgefilterte Teilmenge: ${candidates.length} von finara aktuell geführte Instrumente, nicht der Gesamtmarkt.`,
        ...(wasTwelveDataRateLimitedRecently() ? { rateLimitNote: RATE_LIMIT_NOTE } : {}),
        ranking: sorted.map((r, index) => {
          const topUsed = [...r.result.usedScores].sort(
            (a, b) => b.score * b.normalizedWeight - a.score * a.normalizedWeight,
          )[0];
          return {
            rank: index + 1,
            symbol: r.instrument.symbol,
            name: r.instrument.name,
            assetClass: r.instrument.assetClass,
            dataSource: r.instrument.source,
            compositeScore: r.result.compositeScore,
            topDriver: topUsed ? `${topUsed.label}: ${topUsed.score}/100` : null,
          };
        }),
      });
    }
    case "explain_term": {
      const term = String(input.term ?? "").toLowerCase();
      const entry = glossary.find((g) => g.pattern.test(term));
      return entry ? entry.answer : "Für diesen Begriff liegt kein Glossar-Eintrag vor.";
    }
    case "get_market_overview": {
      const indices = getMarketIndices();
      return JSON.stringify({
        dataSource: "simulated",
        indices: indices.map((i) => ({
          symbol: i.symbol,
          name: i.name,
          value: i.value.toFixed(2),
          changePercent1d: `${i.changePercent1d.toFixed(2)} %`,
        })),
        note: "Index-Kurse sind deterministische Simulationsdaten, keine Live-Kurse. VIX/Volatilitätsindex, Sektor-Performance und Forex-/Währungspaare sind bei finara aktuell nicht angebunden.",
      });
    }
    case "get_news": {
      const symbol = typeof input.symbol === "string" && input.symbol.trim() ? input.symbol.trim() : undefined;
      const items = symbol ? await getNewsForSymbols([symbol]) : await getGeneralMarketNews();
      return JSON.stringify({
        scope: symbol ? `Nachrichten zu ${symbol}` : "Allgemeine Marktnachrichten",
        items: items.slice(0, 8).map((n) => ({
          title: n.title,
          source: n.source,
          publishedAt: n.publishedAt,
          summary: n.summary,
          relatedSymbols: n.relatedSymbols,
        })),
      });
    }
    case "get_watchlist": {
      const items = await getWatchlist(appUser.id);
      if (items.length === 0) {
        return JSON.stringify({ hasItems: false, message: "Der Nutzer hat noch keine Instrumente auf der Watchlist." });
      }
      const enriched = await Promise.all(
        items.map(async (item) => {
          const instrument = await getInstrument(item.symbol);
          if (!instrument) return { symbol: item.symbol, found: false, message: `Kein Instrument mit Symbol ${item.symbol} gefunden.` };
          const sector =
            instrument.assetClass === "stock"
              ? ((await getSectorSafe(instrument.symbol)) ?? "nicht verfügbar")
              : "nicht zutreffend (kein Sektor für diese Anlageklasse)";
          return {
            symbol: instrument.symbol,
            name: instrument.name,
            assetClass: instrument.assetClass,
            price: formatCurrency(instrument.price, instrument.currency),
            changePercent1d: `${instrument.changePercent1d.toFixed(1)} %`,
            changePercent30d: `${instrument.changePercent30d.toFixed(1)} %`,
            volatility: instrument.volatility,
            dataSource: instrument.source,
            sector,
          };
        }),
      );
      return JSON.stringify({
        hasItems: true,
        count: enriched.length,
        items: enriched,
        note: "Sektor stammt aus Financial-Modeling-Prep-Firmendaten und ist nur für Aktienpositionen verfügbar.",
      });
    }
    case "get_fundamentals": {
      const symbol = String(input.symbol ?? "").toUpperCase();
      if (!isFmpConfigured()) {
        return JSON.stringify({ found: false, message: "Fundamentaldaten-Anbindung ist bei finara aktuell nicht konfiguriert." });
      }
      if (!hasFundamentalsCoverage(symbol)) {
        const instrument = await getInstrument(symbol);
        if (instrument?.assetClass !== "stock") {
          return JSON.stringify({
            found: false,
            message: `Fundamentaldaten für ${symbol} sind bei finara nicht verfügbar — Kennzahlen wie KGV/PEG gelten nur für Aktien, nicht für ${symbol}.`,
          });
        }
        // Full ratios/EPS/estimates are plan-restricted to FUNDAMENTALS_COVERED_SYMBOLS, but FMP's
        // /profile endpoint answers for every stock on this plan — surface sector/market cap
        // instead of a flat "nichts verfügbar" for symbols like SAP/ASML.
        try {
          const profile = await getCompanyProfile(symbol);
          if (!profile) {
            return JSON.stringify({ found: false, message: `Fundamentaldaten für ${symbol} sind bei finara aktuell nicht verfügbar.` });
          }
          return JSON.stringify({
            found: true,
            limitedCoverage: true,
            symbol,
            sector: profile.sector ?? "nicht verfügbar",
            marketCap: profile.marketCap === null ? "nicht verfügbar" : formatCurrency(profile.marketCap, "USD"),
            peRatio: "nicht verfügbar",
            pegRatio: "nicht verfügbar",
            priceToSalesRatio: "nicht verfügbar",
            debtToEquity: "nicht verfügbar",
            dividendYieldPercent: "nicht verfügbar",
            freeCashFlowPerShare: "nicht verfügbar",
            eps: "nicht verfügbar",
            analystEstimates: "nicht verfügbar",
            dataSource: "Financial Modeling Prep",
            message: `Für ${symbol} sind nur Sektor und Marktkapitalisierung verfügbar — KGV/PEG/KUV/Verschuldungsgrad/Dividendenrendite/Cashflow/EPS/Analystenschätzungen deckt der Datenanbieter für dieses Symbol auf dem aktuellen Tarif nicht ab.`,
          });
        } catch (err) {
          if (err instanceof FmpDailyLimitReachedError) {
            return JSON.stringify({
              found: false,
              rateLimited: true,
              message: `Fundamentaldaten-Kontingent für heute ausgeschöpft, verfügbar ab ${fmpDailyResetLabel()}.`,
            });
          }
          throw err;
        }
      }

      try {
        const summary = await getFundamentalsSummary(symbol);
        if (!summary) {
          return JSON.stringify({ found: false, message: `Für ${symbol} konnten aktuell keine Fundamentaldaten abgerufen werden.` });
        }
        return JSON.stringify({
          found: true,
          symbol,
          peRatio: fmtFundamentalNumber(summary.peRatio),
          pegRatio: fmtFundamentalNumber(summary.pegRatio),
          priceToSalesRatio: fmtFundamentalNumber(summary.priceToSalesRatio),
          debtToEquity: fmtFundamentalNumber(summary.debtToEquity),
          dividendYieldPercent: summary.dividendYield === null ? "nicht verfügbar" : `${(summary.dividendYield * 100).toFixed(2)} %`,
          // FUNDAMENTALS_COVERED_SYMBOLS (NVDA/MSFT/TSLA) are all USD-denominated US listings —
          // formatCurrency defaults to EUR, which would mislabel these values with the wrong
          // currency symbol if left unspecified.
          freeCashFlowPerShare: summary.freeCashFlowPerShare === null ? "nicht verfügbar" : formatCurrency(summary.freeCashFlowPerShare, "USD"),
          eps: summary.eps === null ? "nicht verfügbar" : formatCurrency(summary.eps, "USD"),
          marketCap: summary.marketCap === null ? "nicht verfügbar" : formatCurrency(summary.marketCap, "USD"),
          sector: summary.sector ?? "nicht verfügbar",
          analystEstimates:
            summary.estimates?.map((e) => ({
              fiscalYearEnd: e.fiscalYearEnd,
              revenueAvg: formatCurrency(e.revenueAvg, "USD"),
              epsAvg: e.epsAvg.toFixed(2),
            })) ?? "nicht verfügbar",
          dataSource: "Financial Modeling Prep",
        });
      } catch (err) {
        if (err instanceof FmpDailyLimitReachedError) {
          return JSON.stringify({
            found: false,
            rateLimited: true,
            message: `Fundamentaldaten-Kontingent für heute ausgeschöpft, verfügbar ab ${fmpDailyResetLabel()}.`,
          });
        }
        throw err;
      }
    }
    case "get_intraday_technicals": {
      const symbol = String(input.symbol ?? "").toUpperCase();
      const timeframes = Array.isArray(input.timeframes) && input.timeframes.length > 0 ? (input.timeframes as IntradayTimeframe[]) : undefined;
      const result = await getIntradayTechnicals(symbol, timeframes);
      return JSON.stringify(result);
    }
    case "get_market_status": {
      const exchange = String(input.exchange ?? "US") as "US" | "XETRA" | "CRYPTO";
      if (exchange !== "US" && exchange !== "XETRA" && exchange !== "CRYPTO") {
        return JSON.stringify({ found: false, message: `Unbekannte Börse "${exchange}".` });
      }
      return JSON.stringify(computeMarketStatus(exchange));
    }
    case "get_stock_report_data": {
      const symbol = String(input.symbol ?? "").toUpperCase();
      const instrument = await getInstrument(symbol);
      if (!instrument) return JSON.stringify({ found: false, message: `Kein Instrument mit Symbol ${symbol} gefunden.` });

      const [analysis, performance, newsItems, analystCounts] = await Promise.all([
        computeAnalysisForInstrument(instrument),
        getPerformanceTable(symbol, instrument),
        getNewsForSymbols([symbol]),
        fetchAnalystCountsFor(symbol),
      ]);

      const multiHorizon = await getMultiHorizonSignal(symbol, analysis.scores.technical.score);

      let fundamentals: {
        sector: string | null;
        marketCap: string | null;
        peRatio: string;
        pegRatio: string;
        extended: Awaited<ReturnType<typeof getExtendedFundamentals>> | null;
        coverageNote: string;
        rateLimited?: boolean;
      };
      if (!isFmpConfigured()) {
        fundamentals = {
          sector: null,
          marketCap: null,
          peRatio: "nicht verfügbar",
          pegRatio: "nicht verfügbar",
          extended: null,
          coverageNote: "Fundamentaldaten-Anbindung ist bei finara aktuell nicht konfiguriert.",
        };
      } else {
        try {
          if (hasFundamentalsCoverage(symbol)) {
            const [summary, extended] = await Promise.all([getFundamentalsSummary(symbol), getExtendedFundamentals(symbol, instrument.price)]);
            fundamentals = {
              sector: summary?.sector ?? null,
              marketCap: summary?.marketCap === null || summary?.marketCap === undefined ? null : formatCurrency(summary.marketCap, "USD"),
              peRatio: fmtFundamentalNumber(summary?.peRatio ?? null),
              pegRatio: fmtFundamentalNumber(summary?.pegRatio ?? null),
              extended,
              coverageNote: "Volle Fundamentaldaten-Abdeckung.",
            };
          } else if (instrument.assetClass === "stock") {
            const profile = await getCompanyProfile(symbol);
            fundamentals = {
              sector: profile?.sector ?? null,
              marketCap: profile?.marketCap === null || profile?.marketCap === undefined ? null : formatCurrency(profile.marketCap, "USD"),
              peRatio: "nicht verfügbar",
              pegRatio: "nicht verfügbar",
              extended: null,
              coverageNote: `Für ${symbol} sind nur Sektor/Marktkapitalisierung verfügbar — KGV/PEG/Margen/Bilanzkennzahlen/Earnings deckt der Datenanbieter für dieses Symbol auf dem aktuellen Tarif nicht ab.`,
            };
          } else {
            fundamentals = {
              sector: null,
              marketCap: null,
              peRatio: "nicht verfügbar",
              pegRatio: "nicht verfügbar",
              extended: null,
              coverageNote: `Fundamentaldaten gelten konzeptionell nicht für ${instrument.assetClass === "crypto" ? "Kryptowährungen" : "ETFs"}.`,
            };
          }
        } catch (err) {
          if (err instanceof FmpDailyLimitReachedError) {
            fundamentals = {
              sector: null,
              marketCap: null,
              peRatio: "nicht verfügbar",
              pegRatio: "nicht verfügbar",
              extended: null,
              coverageNote: `Fundamentaldaten-Kontingent für heute ausgeschöpft, verfügbar ab ${fmpDailyResetLabel()}.`,
              rateLimited: true,
            };
          } else {
            throw err;
          }
        }
      }

      return JSON.stringify({
        found: true,
        symbol,
        name: instrument.name,
        assetClass: instrument.assetClass,
        price: formatCurrency(instrument.price, instrument.currency),
        changePercent1d: `${instrument.changePercent1d.toFixed(1)} %`,
        dataSource: instrument.source,
        performance: performance.windows,
        rsi: analysis.scores.technical.factors.find((f) => f.label.startsWith("RSI"))?.value ?? "nicht verfügbar",
        technicalHorizons: multiHorizon.horizons,
        divergenceNote: multiHorizon.divergenceNote,
        sector: fundamentals.sector ?? "nicht verfügbar",
        marketCap: fundamentals.marketCap ?? "nicht verfügbar",
        peRatio: fundamentals.peRatio,
        pegRatio: fundamentals.pegRatio,
        beta: "nicht verfügbar",
        fundamentalsCoverageNote: fundamentals.coverageNote,
        ...(fundamentals.rateLimited ? { fundamentalsRateLimited: true } : {}),
        margins: fundamentals.extended?.margins ?? "nicht verfügbar",
        balanceSheetCheck: {
          currentRatio: fundamentals.extended?.currentRatio ?? "nicht verfügbar",
          returnOnEquityPct: fundamentals.extended?.returnOnEquityPct ?? "nicht verfügbar",
          freeCashFlowYieldPct: fundamentals.extended?.freeCashFlowYieldPct ?? "nicht verfügbar",
          debtToEquity: fundamentals.extended?.debtToEquity ?? "nicht verfügbar",
          cashPosition: "nicht verfügbar",
        },
        lastEarnings: fundamentals.extended?.lastEarnings ?? "nicht verfügbar",
        nextEarningsDate: "nicht verfügbar",
        consensusRevisionTrend: "nicht verfügbar",
        news: newsItems.slice(0, 5).map((n) => ({ title: n.title, source: n.source, publishedAt: n.publishedAt, summary: n.summary })),
        analystCounts: analystCounts ?? "nicht verfügbar",
        ...(wasTwelveDataRateLimitedRecently() ? { rateLimitNote: RATE_LIMIT_NOTE } : {}),
      });
    }
    case "screen_momentum_candidates": {
      const minChangePct = typeof input.minChangePct === "number" ? input.minChangePct : 2;
      const limit = typeof input.limit === "number" && input.limit > 0 ? Math.floor(input.limit) : 3;

      // Deliberately Object.keys(liveSymbols), not getAllInstruments() — momentum screening needs
      // a real RSI/volume read, which only exists for finara's live-mapped symbols (see
      // lib/market-data/symbols.ts); a mock/simulated instrument's "RSI" would be computed from
      // synthetic data pretending to be a real momentum signal.
      const liveInstruments = (
        await Promise.all(Object.keys(liveSymbols).map((symbol) => getInstrument(symbol)))
      ).filter((i): i is Instrument => i !== null);

      const screened = await Promise.all(
        liveInstruments.map(async (instrument) => {
          const analysis = await computeAnalysisForInstrument(instrument);
          const rsiFactor = analysis.scores.technical.factors.find((f) => f.label.startsWith("RSI"));
          const rsiValue = rsiFactor ? parseFloat(rsiFactor.value) : NaN;
          const hasLiquidity = analysis.scores.volume.availability === "available";
          return { instrument, rsiValue, hasLiquidity };
        }),
      );

      const candidates = screened
        .filter(
          (c) =>
            c.instrument.changePercent1d >= minChangePct &&
            !Number.isNaN(c.rsiValue) &&
            c.rsiValue >= 50 &&
            c.rsiValue <= 80 &&
            c.hasLiquidity,
        )
        .sort((a, b) => b.instrument.changePercent1d - a.instrument.changePercent1d)
        .slice(0, limit);

      return JSON.stringify({
        scopeNote: `Vorgefilterte Teilmenge: ${liveInstruments.length} bei finara live angebundene Instrumente, NICHT der Gesamtmarkt.`,
        candidatesTotal: liveInstruments.length,
        criteria: `Tagesperformance ≥ ${minChangePct} %, RSI zwischen 50 und 80, ausreichende Volumendaten für eine Liquiditätseinschätzung.`,
        ...(wasTwelveDataRateLimitedRecently() ? { rateLimitNote: RATE_LIMIT_NOTE } : {}),
        candidates: candidates.map((c) => ({
          symbol: c.instrument.symbol,
          name: c.instrument.name,
          assetClass: c.instrument.assetClass,
          price: formatCurrency(c.instrument.price, c.instrument.currency),
          changePercent1d: `${c.instrument.changePercent1d.toFixed(1)} %`,
          rsi: c.rsiValue.toFixed(1),
          dataSource: c.instrument.source,
        })),
      });
    }
    case "calculate_pivot_points": {
      const symbol = String(input.symbol ?? "");
      const timeframe = (typeof input.timeframe === "string" ? input.timeframe : "1D") as PivotTimeframe;
      const result = await getPivotPoints(symbol, timeframe === "1W" ? "1W" : "1D");
      return JSON.stringify(result);
    }
    case "export_analysis": {
      const instrument = String(input.instrument ?? "").trim();
      const format = String(input.format ?? "");
      const analysis = findExportableAnalysis(history, instrument);
      if (!analysis) {
        return JSON.stringify({
          exported: false,
          message: `Für "${instrument}" liegt in diesem Gespräch noch keine Analyse vor. Erst eine Analyse erstellen (z. B. Score-, SWOT- oder Markteinschätzung), dann erneut exportieren.`,
        });
      }

      const slug = analysis.typ.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const formats: Record<string, { mimeType: string; buffer: () => Promise<Buffer> | Buffer }> = {
        csv: { mimeType: "text/csv;charset=utf-8", buffer: () => exportToCsv(analysis) },
        docx: {
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: () => exportToDocx(analysis),
        },
        pptx: {
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          buffer: () => exportToPptx(analysis),
        },
      };
      const chosen = formats[format];
      if (!chosen) {
        return JSON.stringify({ exported: false, message: `Format "${format}" wird nicht unterstützt — nur csv, docx oder pptx.` });
      }

      const buffer = await chosen.buffer();
      return JSON.stringify({
        exported: true,
        type: "export_ready",
        instrument: analysis.instrument,
        typ: analysis.typ,
        format,
        fileName: `${analysis.instrument}-${slug}.${format}`,
        mimeType: chosen.mimeType,
        dataUrl: `data:${chosen.mimeType};base64,${buffer.toString("base64")}`,
      });
    }
    default:
      return "Unbekanntes Tool.";
  }
}
