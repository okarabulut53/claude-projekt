import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUser } from "@/lib/types";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: { apiKey: string }) {
      void _opts;
    }
  }
  return { default: MockAnthropic };
});

vi.mock("@/lib/chat-engine", () => ({
  generateChatReply: vi.fn(
    async () =>
      "Dazu liegen mir aktuell keine verlässlichen Daten vor. Frag mich gern nach deinem Portfolio-Wert, konkreten Instrumenten (z. B. \"Wie sieht NVIDIA aus?\") oder allgemeinen Finanzbegriffen wie ETF oder Volatilität.",
  ),
}));

const { buildSystemPrompt, presentationTools, presentationTypes, generateFinaraReply } = await import("./client");
const { generateChatReply } = await import("@/lib/chat-engine");

/**
 * Guardrail, not a behavior test — this can't verify Claude actually follows the prompt, only
 * that the load-bearing anti-hallucination sentences are still present in it. Fails loudly if a
 * future edit accidentally drops one of these rules instead of deliberately rewording it.
 */
describe("buildSystemPrompt anti-hallucination guardrails", () => {
  const prompt = buildSystemPrompt();

  it("forbids inventing numbers", () => {
    expect(prompt).toMatch(/Erfinde niemals Zahlen/);
  });

  it("forbids buy/sell instructions", () => {
    expect(prompt).toMatch(/niemals.*Kauf- oder Verkaufsanweisungen/);
  });

  it("forbids guaranteed-return language", () => {
    expect(prompt).toMatch(/wird steigen/);
  });

  it("requires get_analysis for technical/analytical assessments", () => {
    expect(prompt).toMatch(/MUSST du get_analysis aufrufen/);
  });

  it("requires citing unavailableReason instead of guessing when a score is missing", () => {
    expect(prompt).toMatch(/unavailableReason/);
  });

  it("requires surfacing conflicting strategy signals instead of smoothing them over", () => {
    expect(prompt).toMatch(/widersprüchliches Signal/);
  });

  it("requires re-calling tools on follow-up 'why' questions instead of trusting memory", () => {
    expect(prompt).toMatch(/ERNEUT aufzurufen|ERNEUT auf/);
  });

  it("forbids price targets / return promises in Bull/Base/Bear cases", () => {
    expect(prompt).toMatch(/KEINE Kursziele und KEINE Renditeangaben/);
  });

  it("distinguishes the curated aiOpportunity placeholder from real get_analysis output", () => {
    expect(prompt).toMatch(/redaktionell kuratierte Platzhalter-Einschätzung/);
  });

  it("clarifies that a higher risk score means lower risk, not higher", () => {
    // Regression guard: observed live that without this, Claude read a risk score of 79/100 as
    // "hohe Risikoklasse" (high risk) — the opposite of what the score actually means.
    expect(prompt).toMatch(/HÖHERER Wert GERINGERES Risiko/);
  });

  it("forbids recommendation-style language in ranking answers", () => {
    expect(prompt).toMatch(/niemals "ich empfehle", "greif zu", "das lohnt sich" oder "gute Kaufgelegenheit"/);
  });

  it("requires get_ranking results to be scoped as a subset, not the whole market", () => {
    expect(prompt).toMatch(/nicht über den gesamten Markt/);
  });

  it("requires the mandatory closing disclaimer sentence on analysis/score/ranking answers", () => {
    expect(prompt).toMatch(/keine Anlageberatung und keine Erfolgsgarantie/);
  });

  it("directs score-/probability requests to present_score_analysis instead of a markdown table", () => {
    expect(prompt).toMatch(/present_score_analysis/);
    expect(prompt).toMatch(/rendert kein Markdown/);
  });

  it("documents marketEnvironment as always unavailable rather than a fabricated proxy", () => {
    expect(prompt).toMatch(/marketEnvironment \(aktuell IMMER unavailable/);
  });

  it("forbids writing a presentation tool's JSON shape as plain text instead of calling it", () => {
    expect(prompt).toMatch(/ECHTE Tool-Aufrufe.*keine Textvorlage/);
  });
});

/**
 * Etappe 8 guardrails, same "prompt still says the right thing" contract as above — added
 * alongside the SWOT/Bull-Bear/Markttrend/News/Watchlist card types and the education-question
 * request type so a future prompt edit can't silently drop one of these sections.
 */
describe("buildSystemPrompt Etappe 8 guardrails", () => {
  const prompt = buildSystemPrompt();

  it("routes SWOT requests to present_swot_analysis", () => {
    expect(prompt).toMatch(/SWOT-Analyse.*present_swot_analysis/);
  });

  it("routes bull-vs-bear requests to present_bull_bear_analysis", () => {
    expect(prompt).toMatch(/Bullen-vs-Bären-Analyse.*present_bull_bear_analysis/);
  });

  it("routes market-trend requests without a single instrument to present_market_overview", () => {
    expect(prompt).toMatch(/Markttrend-Anfragen ohne Einzelinstrument.*present_market_overview/);
  });

  it("routes news requests to present_news_summary", () => {
    expect(prompt).toMatch(/Nachrichten-Zusammenfassung.*present_news_summary/);
  });

  it("routes score-scoped watchlist requests to present_ranking via get_ranking(watchlistOnly)", () => {
    expect(prompt).toMatch(/watchlistOnly=true aufrufen/);
  });

  it("routes non-score watchlist requests to present_watchlist_overview", () => {
    expect(prompt).toMatch(/present_watchlist_overview/);
  });

  it("gives pure educational/definition questions no mandatory disclaimer", () => {
    expect(prompt).toMatch(/Reine Definitionsfragen.*KEINEN Pflicht-Disclaimer/);
  });

  it("refuses a personalized recommendation disguised as an educational question", () => {
    expect(prompt).toMatch(/klingt eine Frage wie eine Bildungsfrage, fragt aber tatsächlich nach einer PERSÖNLICHEN Empfehlung/);
    expect(prompt).toMatch(/KEINE personalisierte Empfehlung/);
  });

  it("never treats the background chart ticker as automatically relevant to a follow-up question", () => {
    expect(prompt).toMatch(/NIEMALS automatisch die Antwort auf eine Anschlussfrage/);
  });

});

/**
 * Guardrails for the FMP fundamentals go-live: get_fundamentals/present_fundamentals_analysis
 * replace the earlier "prepared but not wired in" placeholder, but the coverage-set honesty rule
 * must survive — a symbol outside NVDA/MSFT/TSLA must still get an honest limitedCoverage/"nicht
 * verfügbar" for the ratio fields, not a guess. Sector is now available per-position (get_watchlist/
 * get_portfolio_summary, via FMP's ungated /profile endpoint), so it's no longer in the
 * always-unavailable list — but metrics finara still has no provider for at all (KBV, Forex, VIX)
 * must stay flagged as unavailable, same as before.
 */
describe("buildSystemPrompt fundamentals (FMP) guardrails", () => {
  const prompt = buildSystemPrompt();

  it("routes single-instrument fundamentals requests to get_fundamentals / present_fundamentals_analysis", () => {
    expect(prompt).toMatch(/Fundamentaldaten-Anfragen.*get_fundamentals/);
    expect(prompt).toMatch(/present_fundamentals_analysis/);
  });

  it("scopes fundamentals availability to the verified coverage set, not all instruments", () => {
    expect(prompt).toMatch(/verifiziert abgedeckte Symbole \(aktuell: NVDA, MSFT, TSLA\)/);
  });

  it("still forbids a cross-instrument fundamentals screener that get_ranking can't do", () => {
    expect(prompt).toMatch(/RANKING\/SCREENING.*mehrere Instrumente.*Fundamentaldaten.*WEITERHIN nicht möglich/);
  });

  it("still flags KBV, Forex and VIX as unavailable", () => {
    expect(prompt).toMatch(/KBV, Forex-\/Währungspaare, VIX/);
  });

  it("routes stock symbols outside the ratios/EPS coverage set to a limitedCoverage sector/market-cap fallback instead of a flat 'not available'", () => {
    expect(prompt).toMatch(/limitedCoverage:true mit Sektor\/Marktkapitalisierung/);
  });

  it("offers a per-position sector via get_watchlist and get_portfolio_summary", () => {
    expect(prompt).toMatch(/sector-Feld je Position/);
    expect(prompt).toMatch(/sectorAllocation/);
  });

  it("combines valuation and score for fully covered symbols instead of treating them as unrelated request types", () => {
    expect(prompt).toMatch(/Kombiniere Bewertung und Score/);
  });

  it("relays a rateLimited get_fundamentals message the same honest way as Twelve Data's rateLimitNote", () => {
    expect(prompt).toMatch(/Liefert get_fundamentals rateLimited:true/);
  });
});

/**
 * Regression guard for the exact bug documented in CHATBOT_ANALYSE.md: the 5 Etappe-8
 * present_*-tools were added to the tools array sent to the API but not to the presentationTypes
 * lookup client.ts uses to recognize a terminal tool_use block as a card — so they silently fell
 * through to runFinanceTool's "Unbekanntes Tool." fallback and the bot answered with a prose
 * apology instead of rendering a card. This test fails the moment a future present_*-tool is
 * added to presentationTools without a matching presentationTypes entry, without needing a live
 * API call to notice.
 */
describe("presentationTypes / presentationTools stay in sync", () => {
  it("has a presentationTypes entry for every tool in presentationTools", () => {
    for (const tool of presentationTools) {
      expect(presentationTypes).toHaveProperty(tool.name);
    }
  });

  it("has no presentationTypes entry for a tool no longer in presentationTools (stale mapping)", () => {
    const toolNames = new Set(presentationTools.map((t) => t.name));
    for (const name of Object.keys(presentationTypes)) {
      expect(toolNames.has(name)).toBe(true);
    }
  });
});

/**
 * Regression guard for a live-observed inconsistency: a follow-up "wieso X?" question about an
 * instrument from a prior get_ranking result answered in prose (RSI/ADX/SMA etc. as a paragraph)
 * instead of the same present_score_analysis card a direct single-instrument analysis gets, and a
 * score request with no recognizable ticker ("analysiere mit score") fell all the way through to
 * chat-engine.ts's fixed fallback sentence instead of the real Claude path asking a clarifying
 * question. These two prompt guardrails close that gap.
 */
describe("buildSystemPrompt follow-up score-analysis guardrails", () => {
  const prompt = buildSystemPrompt();

  it("requires present_* tools even for follow-up/detail/reasoning questions about an existing analysis or ranking", () => {
    expect(prompt).toMatch(/Strukturierte Ausgabe ist verpflichtend, auch bei Anschlussfragen/);
    expect(prompt).toMatch(/Freitext-Antworten mit Kennzahlen sind für diese Anfragekategorie NIEMALS erlaubt/);
  });

  it("routes a single-instrument follow-up from a prior ranking to get_analysis + present_score_analysis", () => {
    expect(prompt).toMatch(/Rückfrage zu einem einzelnen Instrument aus einem vorherigen get_ranking-Ergebnis/);
    expect(prompt).toMatch(/gib das Ergebnis über present_score_analysis aus/);
  });

  it("requires a concrete clarifying question instead of a tool call when no instrument is named in an analysis/score request", () => {
    expect(prompt).toMatch(/Fehlender Ticker bei Analyse-\/Score-Anfrage/);
    expect(prompt).toMatch(/Für welches Instrument möchtest du eine Score-Analyse\?/);
  });

  it("forbids the generic 'keine verlässlichen Daten' evasion for a missing-ticker analysis request", () => {
    expect(prompt).toMatch(/NIEMALS die generische "Dazu liegen mir aktuell keine verlässlichen Daten vor"-Ausweichformulierung/);
  });
});

/**
 * Behavioral tests, unlike the prompt-guardrail describes above: these mock the Anthropic SDK
 * client directly so they exercise the actual routing code in generateFinaraReply rather than
 * only asserting the prompt text asks for the right thing (a real model call can't be part of a
 * unit test). @anthropic-ai/sdk and lib/chat-engine are both mocked at module scope above, before
 * client.ts is imported, so buildAnthropicClient() picks up the mock class instead of the real
 * SDK.
 */
describe("generateFinaraReply follow-up and missing-ticker routing", () => {
  const appUser: AppUser = {
    id: "user_1",
    email: "test@example.com",
    riskProfile: "medium",
    whatsappNumber: null,
    depotConnected: false,
    onboardingCompletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.CLAUDE_CHATBOT_API_KEY = "test-key";
    createMock.mockReset();
    vi.mocked(generateChatReply).mockClear();
  });

  afterEach(() => {
    delete process.env.CLAUDE_CHATBOT_API_KEY;
  });

  it("returns a present_score_analysis card for a follow-up 'wieso MSFT?' question, not prose", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "present_score_analysis",
          input: { symbol: "MSFT", scoreSummary: "stub" },
        },
      ],
      stop_reason: "tool_use",
    });

    const history = [
      {
        id: "m1",
        threadId: "t1",
        role: "user" as const,
        content: "Gib mir einen Aktien-Vorschlag",
        createdAt: new Date().toISOString(),
      },
      {
        id: "m2",
        threadId: "t1",
        role: "assistant" as const,
        content: JSON.stringify({ type: "ranking", entries: [{ symbol: "MSFT" }, { symbol: "SAP" }, { symbol: "NVDA" }] }),
        createdAt: new Date().toISOString(),
      },
    ];

    const result = await generateFinaraReply("wieso MSFT?", appUser, [], history);

    expect(JSON.parse(result.reply)).toMatchObject({ type: "score_analysis", symbol: "MSFT" });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(generateChatReply).not.toHaveBeenCalled();
  });

  it("asks a concrete clarifying question for a score request with no recognizable ticker, without calling a tool or the fallback engine", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "Für welches Instrument möchtest du eine Score-Analyse? (z. B. SAP, MSFT, NVDA)",
        },
      ],
      stop_reason: "end_turn",
    });

    const result = await generateFinaraReply("analysiere mit score", appUser, [], []);

    expect(result.reply).toMatch(/Für welches Instrument/);
    expect(result.reply).not.toMatch(/Frag mich gern nach deinem Portfolio-Wert/);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(generateChatReply).not.toHaveBeenCalled();
  });

  it("never falls back to chat-engine.ts's rule-based engine for an analysis/score request while a valid API key is configured", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_2",
          name: "present_score_analysis",
          input: { symbol: "SAP", scoreSummary: "stub" },
        },
      ],
      stop_reason: "tool_use",
    });

    await generateFinaraReply("score von SAP?", appUser, [], []);

    expect(generateChatReply).not.toHaveBeenCalled();
  });
});

/**
 * Regression guard for a second, structurally similar case of the same underlying issue as the
 * "follow-up score-analysis" block above: "welche Aktie würdest du mir langfristig empfehlen?"
 * was observed live landing in chat-engine.ts's fixed fallback sentence, while the near-identical
 * "welche Aktie würdest du mir für heute vorschlagen zu kaufen nach Score?" was correctly routed
 * and triggered present_ranking. There is no keyword-based gate anywhere in the code that decides
 * "real Claude API vs. rule-based fallback" — buildAnthropicClient() only checks for an API key,
 * and generateFinaraReply only falls back to chat-engine.ts on a missing key or a thrown
 * exception (see the try/catch at the bottom of generateFinaraReply). The actual bug was a prompt
 * gap: "langfristig empfehlen" sits ambiguously between the existing ranking-trigger rule and the
 * "Abgrenzung Wissen vs. persönliche Empfehlung" refusal rule (both plausible matches for a
 * "würdest du mir ... empfehlen" phrasing), with nothing in the prompt disambiguating the two —
 * closed by the new "LANGFRISTIGE EMPFEHLUNGS-/RANKING-ANFRAGEN" rule plus the added carve-out in
 * the Abgrenzung rule.
 */
describe("buildSystemPrompt long-term ranking guardrails", () => {
  const prompt = buildSystemPrompt();

  it("routes long-term recommendation requests to get_ranking with strategyId=long-term + present_ranking", () => {
    expect(prompt).toMatch(/LANGFRISTIGE EMPFEHLUNGS-\/RANKING-ANFRAGEN/);
    expect(prompt).toMatch(/strategyId="long-term"/);
  });

  it("carves long-term instrument recommendations out of the personal-recommendation refusal rule", () => {
    expect(prompt).toMatch(/NICHT hierher gehören Fragen nach einer konkreten Instrumenten-Empfehlung\/einem Ranking/);
    expect(prompt).toMatch(/welche Aktie würdest du mir langfristig empfehlen\?" ist trotz der Formulierung eine Screening-\/Ranking-Anfrage/);
  });
});

/**
 * Guardrails for the Kurzfrist-Vergleichsanalyse feature (present_shortterm_comparison): a
 * ticker-less short-term comparison request must fall back to the user's watchlist for
 * candidates (rather than the model inventing tickers), and the prompt must strictly forbid
 * direct buy-verdict language even though the underlying data may point clearly to one candidate
 * — regression protection for the "sprachliche Regel" from that feature's spec.
 */
describe("buildSystemPrompt short-term comparison guardrails", () => {
  const prompt = buildSystemPrompt();

  it("routes ticker-less short-term comparison requests to get_watchlist for candidates", () => {
    expect(prompt).toMatch(/KURZFRIST-VERGLEICHSANALYSE/);
    expect(prompt).toMatch(/Nennt die Anfrage KEINE konkreten Ticker, per get_watchlist die Kandidaten/);
  });

  it("requires get_market_status to be checked and surfaced prominently before the analysis", () => {
    expect(prompt).toMatch(/get_market_status[\s\S]*aufrufen[\s\S]*MUSS[\s\S]*PROMINENT ganz am Anfang/);
  });

  it("forbids direct buy-verdict language for short-term comparisons, even with a clear data lead", () => {
    expect(prompt).toMatch(/NIEMALS "ist die klar bessere Wahl", "sollten Sie kaufen", "ich empfehle"/);
    expect(prompt).toMatch(/auch bei sehr kurzen Zeithorizonten und auch wenn die Datenlage eindeutig für einen Kandidaten spricht/);
  });

  it("embeds present_score_analysis's field structure per candidate instead of replacing it with prose", () => {
    expect(prompt).toMatch(/candidates\[\]\.scoreAnalysis übernimmt exakt dieselbe Feldstruktur wie present_score_analysis/);
    expect(prompt).toMatch(/NIEMALS die eingebettete Score-Analyse durch Fließtext ersetzen/);
  });

  it("documents the generic optional suggestedFollowUp mechanism, used sparingly", () => {
    expect(prompt).toMatch(/suggestedFollowUp/);
    expect(prompt).toMatch(/Nutze das SPARSAM/);
  });
});

/**
 * Guardrails for the Daytrading-Kandidaten-Screener feature (present_daytrading_screener): the
 * risk-management checklist must be present on every response of this type regardless of what
 * the model returns (DaytradingScreenerCard.tsx renders it statically, never from a model field —
 * this test asserts the prompt documents that so a future edit can't accidentally make it
 * model-optional), and a beginner-signal request must get the risk warning surfaced before the
 * candidate list, not omitted.
 */
describe("buildSystemPrompt daytrading screener guardrails", () => {
  const prompt = buildSystemPrompt();

  it("routes market-wide, non-watchlist short-term candidate requests to screen_momentum_candidates + present_daytrading_screener", () => {
    expect(prompt).toMatch(/DAYTRADING-SCREENER-ANFRAGEN/);
    expect(prompt).toMatch(/screen_momentum_candidates aufrufen/);
    expect(prompt).toMatch(/present_daytrading_screener ausgeben/);
  });

  it("documents that the risk-management checklist is rendered by the card itself, always present, never model-shortenable", () => {
    expect(prompt).toMatch(/Risikomanagement-Checkliste wird von der Karte selbst fest angezeigt \(nicht von dir befüllt\)/);
  });

  it("requires a beginner risk warning before the candidate list for beginner-signal requests, without rejecting the request", () => {
    expect(prompt).toMatch(/ich will Daytrader werden.*beginnerWarning/);
    expect(prompt).toMatch(/die Anfrage NICHT ablehnen/);
  });

  it("requires get_market_status to be surfaced before any candidate, including whether shown data is live or a closing price", () => {
    expect(prompt).toMatch(/IMMER bevor irgendein Kandidat gezeigt wird/);
    expect(prompt).toMatch(/dataFreshnessNote/);
  });
});

/**
 * Guardrails for the Standard-Analysebericht feature (present_stock_report): a plain "Analysiere
 * X" request must be distinguished from an explicit Score-Anfrage (present_score_analysis) and
 * from an explicit Tiefenanalyse-Anfrage — finara has no separate deep-analysis tier beyond the
 * Standard-Analysebericht, so that third case must get an honest explanation instead of a
 * fabricated response, not a third card type.
 */
describe("buildSystemPrompt stock report format-disambiguation guardrails", () => {
  const prompt = buildSystemPrompt();

  it("documents all three analysis-format branches with concrete example phrasings", () => {
    expect(prompt).toMatch(/STANDARD-ANALYSEBERICHT/);
    expect(prompt).toMatch(/ABGRENZUNG DER DREI ANALYSEFORMATE/);
    // Score-vocabulary branch — 3 phrasing variants.
    expect(prompt).toMatch(/Score von X/);
    expect(prompt).toMatch(/sollte ich X heute kaufen/);
    expect(prompt).toMatch(/wie hoch ist die Wahrscheinlichkeit/);
    // Plain-analyze branch — 3 phrasing variants.
    expect(prompt).toMatch(/analysiere mir TSLA Aktie/);
    expect(prompt).toMatch(/wie steht es um SAP/);
    expect(prompt).toMatch(/gib mir eine Analyse zu NVDA/);
    // Deep-analysis-request branch — 3 phrasing variants.
    expect(prompt).toMatch(/mach eine Tiefenanalyse zu X/);
    expect(prompt).toMatch(/18-Punkte-Analyse/);
    expect(prompt).toMatch(/vollständige Fundamentalanalyse/);
  });

  it("routes the plain-analyze branch to get_stock_report_data + present_stock_report", () => {
    expect(prompt).toMatch(/Ruf get_stock_report_data auf/);
    expect(prompt).toMatch(/present_stock_report aus/);
  });

  it("honestly explains the lack of a deeper analysis tier instead of fabricating one", () => {
    expect(prompt).toMatch(/finara bietet aktuell KEINE separate, tiefere Analysestufe/);
    expect(prompt).toMatch(/statt eine Tiefenanalyse vorzutäuschen, die es nicht gibt/);
  });

  it("marks margin/balance-sheet/earnings fields as coverage-gated and calendar fields as always unavailable", () => {
    expect(prompt).toMatch(/margins\/balanceSheetCheck\/lastEarnings sind NUR für die FMP-Fundamentaldaten-Abdeckung/);
    expect(prompt).toMatch(/nextEarningsDate und consensusRevisionTrend sind bei finara IMMER "nicht verfügbar"/);
  });
});

describe("generateFinaraReply stock report routing", () => {
  const appUser: AppUser = {
    id: "user_1",
    email: "test@example.com",
    riskProfile: "medium",
    whatsappNumber: null,
    depotConnected: false,
    onboardingCompletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.CLAUDE_CHATBOT_API_KEY = "test-key";
    createMock.mockReset();
    vi.mocked(generateChatReply).mockClear();
  });

  afterEach(() => {
    delete process.env.CLAUDE_CHATBOT_API_KEY;
  });

  it("returns a present_stock_report card for a plain 'analysiere mir TSLA Aktie' request, not present_score_analysis", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_report1",
          name: "present_stock_report",
          input: {
            symbol: "TSLA",
            intro: "stub",
            keyMetrics: { price: "stub", marketCap: "stub", peRatio: "stub", pegRatio: "stub", beta: "nicht verfügbar", rsi: "stub" },
            performance: [],
            technicalHorizons: [],
            bullPoints: [],
            bearPoints: [],
            summary: "stub",
          },
        },
      ],
      stop_reason: "tool_use",
    });

    const result = await generateFinaraReply("analysiere mir TSLA Aktie", appUser, [], []);

    expect(JSON.parse(result.reply)).toMatchObject({ type: "stock_report", symbol: "TSLA" });
    expect(generateChatReply).not.toHaveBeenCalled();
  });
});

describe("generateFinaraReply long-term ranking routing", () => {
  const appUser: AppUser = {
    id: "user_1",
    email: "test@example.com",
    riskProfile: "medium",
    whatsappNumber: null,
    depotConnected: false,
    onboardingCompletedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    process.env.CLAUDE_CHATBOT_API_KEY = "test-key";
    createMock.mockReset();
    vi.mocked(generateChatReply).mockClear();
  });

  afterEach(() => {
    delete process.env.CLAUDE_CHATBOT_API_KEY;
  });

  it("returns a present_ranking card for 'welche Aktie würdest du mir langfristig empfehlen?', not the chat-engine fallback", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_lt1",
          name: "present_ranking",
          input: { period: "langfristig", candidatesTotal: 12, scopeNote: "stub", rows: [] },
        },
      ],
      stop_reason: "tool_use",
    });

    const result = await generateFinaraReply("Welche Aktie würdest du mir langfristig empfehlen?", appUser, [], []);

    expect(JSON.parse(result.reply)).toMatchObject({ type: "ranking" });
    expect(result.reply).not.toMatch(/Frag mich gern nach deinem Portfolio-Wert/);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(generateChatReply).not.toHaveBeenCalled();
  });

  it.each([
    "welche Aktie würdest du mir für heute vorschlagen zu kaufen nach Score?",
    "beste Aktie heute",
    "was würdest du kaufen?",
    "top Instrument nach Score",
    "gute langfristige Investition",
  ])("routes '%s' to the real Claude path (a tool call), never straight to chat-engine.ts's fallback", async (message) => {
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          id: "toolu_variant",
          name: "present_ranking",
          input: { period: "stub", candidatesTotal: 5, scopeNote: "stub", rows: [] },
        },
      ],
      stop_reason: "tool_use",
    });

    const result = await generateFinaraReply(message, appUser, [], []);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.reply)).toMatchObject({ type: "ranking" });
    expect(generateChatReply).not.toHaveBeenCalled();
  });
});
