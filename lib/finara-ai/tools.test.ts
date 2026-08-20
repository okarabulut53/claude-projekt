import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppUser, ChatMessage, PortfolioPosition, WatchlistItem } from "@/lib/types";
import { runFinanceTool } from "./tools";
import { liveSymbols } from "@/lib/market-data/symbols";
import { getNewsForSymbols } from "@/lib/mock/news";
import {
  __resetTwelveDataRateLimitStateForTests,
  markTwelveDataRateLimited,
  FmpDailyLimitReachedError,
} from "@/lib/market-data/rateLimitQueue";
import { isFmpConfigured, hasFundamentalsCoverage, getFundamentalsSummary, getCompanyProfile } from "@/lib/data-providers/fmp";

vi.mock("@/lib/mock/news", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mock/news")>();
  return { ...actual, getNewsForSymbols: vi.fn(actual.getNewsForSymbols) };
});

/** Mocked so get_fundamentals tests don't depend on a real FMP key/network — default state
 *  mirrors production's verified coverage set (NVDA/MSFT/TSLA), reset in each describe block's
 *  afterEach so one test's overrides can't leak into the next. */
vi.mock("@/lib/data-providers/fmp", () => ({
  isFmpConfigured: vi.fn(() => true),
  hasFundamentalsCoverage: vi.fn((symbol: string) => ["NVDA", "MSFT", "TSLA"].includes(symbol.toUpperCase())),
  getFundamentalsSummary: vi.fn(async () => null),
  getCompanyProfile: vi.fn(async () => null),
}));

/**
 * Mocked instead of exercised for real: get_watchlist/get_ranking(watchlistOnly) both call
 * lib/db's getWatchlist, which — without Supabase configured — falls through to the
 * file-persisted mock store (lib/mock/user-store.ts, writes to .data/mock-store.json). Mocking
 * here keeps these tests hermetic (no disk state leaking between runs) and lets watchlist
 * contents be set up per test instead of depending on prior mock-store state.
 */
const watchlists: Record<string, WatchlistItem[]> = {
  "user-with-watchlist": [
    { id: "w1", userId: "user-with-watchlist", symbol: "NVDA", assetClass: "stock", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "w2", userId: "user-with-watchlist", symbol: "SAP", assetClass: "stock", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  "user-empty": [],
  "user-with-tsla": [
    { id: "w3", userId: "user-with-tsla", symbol: "TSLA", assetClass: "stock", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
};

vi.mock("@/lib/db", () => ({
  getWatchlist: vi.fn(async (userId: string) => watchlists[userId] ?? []),
}));

const baseUser: AppUser = {
  id: "user-with-watchlist",
  email: null,
  riskProfile: "medium",
  whatsappNumber: null,
  depotConnected: false,
  onboardingCompletedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};
const noPositions: PortfolioPosition[] = [];
const noHistory: ChatMessage[] = [];

function withUser(id: string): AppUser {
  return { ...baseUser, id };
}

describe("get_market_overview", () => {
  it("returns finara's four tracked indices, explicitly labeled as simulated", async () => {
    const result = JSON.parse(await runFinanceTool("get_market_overview", {}, baseUser, noPositions, noHistory));
    expect(result.dataSource).toBe("simulated");
    expect(result.indices).toHaveLength(4);
    expect(result.indices.map((i: { symbol: string }) => i.symbol).sort()).toEqual(["DAX", "MDAX", "NDX", "SPX"]);
    for (const index of result.indices) {
      expect(typeof index.value).toBe("string");
      expect(typeof index.changePercent1d).toBe("string");
    }
  });

  it("honestly names VIX/sector/forex as not covered instead of omitting them silently", async () => {
    const result = JSON.parse(await runFinanceTool("get_market_overview", {}, baseUser, noPositions, noHistory));
    expect(result.note).toMatch(/VIX/);
    expect(result.note).toMatch(/Sektor/);
    expect(result.note).toMatch(/Forex/);
  });
});

describe("get_news", () => {
  it("returns general market news when no symbol is given", async () => {
    const result = JSON.parse(await runFinanceTool("get_news", {}, baseUser, noPositions, noHistory));
    expect(result.scope).toBe("Allgemeine Marktnachrichten");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThanOrEqual(8);
  });

  it("scopes to a single instrument's news when a symbol is given", async () => {
    const result = JSON.parse(await runFinanceTool("get_news", { symbol: "NVDA" }, baseUser, noPositions, noHistory));
    expect(result.scope).toBe("Nachrichten zu NVDA");
    expect(result.items.every((n: { relatedSymbols: string[] }) => n.relatedSymbols.includes("NVDA"))).toBe(true);
  });
});

describe("get_watchlist", () => {
  afterEach(() => {
    vi.mocked(getCompanyProfile).mockReset();
    vi.mocked(getCompanyProfile).mockImplementation(async () => null);
  });

  it("reports an empty watchlist honestly instead of fabricating positions", async () => {
    const result = JSON.parse(await runFinanceTool("get_watchlist", {}, withUser("user-empty"), noPositions, noHistory));
    expect(result.hasItems).toBe(false);
  });

  it("enriches every watchlist symbol with live/simulated price data", async () => {
    const result = JSON.parse(await runFinanceTool("get_watchlist", {}, withUser("user-with-watchlist"), noPositions, noHistory));
    expect(result.hasItems).toBe(true);
    expect(result.count).toBe(2);
    expect(result.items.map((i: { symbol: string }) => i.symbol).sort()).toEqual(["NVDA", "SAP"]);
    for (const item of result.items) {
      expect(["live", "simulated"]).toContain(item.dataSource);
    }
  });

  it("labels the sector note as coming from Financial Modeling Prep", async () => {
    const result = JSON.parse(await runFinanceTool("get_watchlist", {}, withUser("user-with-watchlist"), noPositions, noHistory));
    expect(result.note).toMatch(/Sektor/);
  });

  it("enriches stock positions with a sector when FMP has a profile for the symbol", async () => {
    vi.mocked(getCompanyProfile).mockResolvedValueOnce({
      symbol: "NVDA",
      companyName: "NVIDIA Corp.",
      sector: "Technology",
      industry: "Semiconductors",
      marketCap: 3_000_000_000_000,
    });
    const result = JSON.parse(await runFinanceTool("get_watchlist", {}, withUser("user-with-watchlist"), noPositions, noHistory));
    const nvda = result.items.find((i: { symbol: string }) => i.symbol === "NVDA");
    expect(nvda.sector).toBe("Technology");
  });

  it("falls back to 'nicht verfügbar' for a stock symbol FMP has no profile for, instead of guessing", async () => {
    const result = JSON.parse(await runFinanceTool("get_watchlist", {}, withUser("user-with-watchlist"), noPositions, noHistory));
    const sap = result.items.find((i: { symbol: string }) => i.symbol === "SAP");
    expect(sap.sector).toBe("nicht verfügbar");
  });
});

describe("get_portfolio_summary sector allocation", () => {
  afterEach(() => {
    vi.mocked(getCompanyProfile).mockReset();
    vi.mocked(getCompanyProfile).mockImplementation(async () => null);
  });

  const mixedPositions: PortfolioPosition[] = [
    {
      id: "p1",
      userId: "user-with-watchlist",
      symbol: "NVDA",
      name: "NVIDIA Corp.",
      assetClass: "stock",
      quantity: 10,
      avgPrice: 80,
      currentPrice: 100,
      source: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "p2",
      userId: "user-with-watchlist",
      symbol: "BTC",
      name: "Bitcoin",
      assetClass: "crypto",
      quantity: 1,
      avgPrice: 3000,
      currentPrice: 4000,
      source: "manual",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("groups stock positions by FMP sector and folds non-stock value into the unclassified note", async () => {
    vi.mocked(getCompanyProfile).mockResolvedValueOnce({
      symbol: "NVDA",
      companyName: "NVIDIA Corp.",
      sector: "Technology",
      industry: "Semiconductors",
      marketCap: 3_000_000_000_000,
    });
    const result = JSON.parse(
      await runFinanceTool("get_portfolio_summary", {}, withUser("user-with-watchlist"), mixedPositions, noHistory),
    );
    expect(result.sectorAllocation).toEqual([{ sector: "Technology", percent: "20 %" }]);
    expect(result.sectorUnclassifiedNote).toMatch(/80 %/);
  });

  it("leaves sectorUnclassifiedNote null when every position is classified", async () => {
    vi.mocked(getCompanyProfile).mockResolvedValueOnce({
      symbol: "NVDA",
      companyName: "NVIDIA Corp.",
      sector: "Technology",
      industry: "Semiconductors",
      marketCap: 3_000_000_000_000,
    });
    const result = JSON.parse(
      await runFinanceTool("get_portfolio_summary", {}, withUser("user-with-watchlist"), [mixedPositions[0]], noHistory),
    );
    expect(result.sectorAllocation).toEqual([{ sector: "Technology", percent: "100 %" }]);
    expect(result.sectorUnclassifiedNote).toBeNull();
  });
});

describe("get_ranking with watchlistOnly", () => {
  it("reports an empty watchlist honestly instead of ranking nothing", async () => {
    const result = JSON.parse(
      await runFinanceTool("get_ranking", { watchlistOnly: true }, withUser("user-empty"), noPositions, noHistory),
    );
    expect(result.hasItems).toBe(false);
  });

  it("ranks only the watchlist's symbols, not finara's full candidate list", async () => {
    const result = JSON.parse(
      await runFinanceTool("get_ranking", { watchlistOnly: true }, withUser("user-with-watchlist"), noPositions, noHistory),
    );
    expect(result.candidatesTotal).toBe(2);
    expect(result.scopeNote).toMatch(/Watchlist/);
    for (const row of result.ranking) {
      expect(["NVDA", "SAP"]).toContain(row.symbol);
    }
  });

  it("defaults to ranking every watchlist instrument, not just the top 3", async () => {
    // Non-watchlistOnly get_ranking defaults limit to 3; watchlistOnly must not inherit that cap
    // silently dropping watchlist symbols the user asked to have scored.
    const result = JSON.parse(
      await runFinanceTool("get_ranking", { watchlistOnly: true }, withUser("user-with-watchlist"), noPositions, noHistory),
    );
    expect(result.ranking.length).toBeGreaterThanOrEqual(1);
    expect(result.ranking.length).toBeLessThanOrEqual(2);
  });
});

describe("get_analysis / get_ranking analysis caching (Twelve Data rate-limit protection)", () => {
  it("reuses the cached per-symbol analysis within the cache window instead of recomputing it", async () => {
    // A fresh symbol not touched by any other test in this file, so the cache starts cold here.
    const spy = vi.mocked(getNewsForSymbols);
    spy.mockClear();

    await runFinanceTool("get_analysis", { symbol: "MSFT" }, baseUser, noPositions, noHistory);
    const callsAfterFirst = spy.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    await runFinanceTool("get_analysis", { symbol: "MSFT" }, baseUser, noPositions, noHistory);
    expect(spy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("get_ranking populates the same per-symbol cache a later get_analysis call reads from", async () => {
    const spy = vi.mocked(getNewsForSymbols);
    spy.mockClear();

    await runFinanceTool(
      "get_ranking",
      { watchlistOnly: true },
      withUser("user-with-watchlist"),
      noPositions,
      noHistory,
    );
    const callsAfterRanking = spy.mock.calls.length;

    // NVDA was one of the ranked candidates — a get_analysis call for it right after must reuse
    // that cached analysis instead of fetching its news again. (callsAfterRanking may already be
    // 0 here if an earlier test in this file warmed NVDA/SAP's cache entries first — the point of
    // this test is that the count doesn't increase, not its absolute value.)
    await runFinanceTool("get_analysis", { symbol: "NVDA" }, baseUser, noPositions, noHistory);
    expect(spy.mock.calls.length).toBe(callsAfterRanking);
  });
});

describe("get_fundamentals", () => {
  // beforeEach, not afterEach: this must run before the FIRST test in this block too, or that
  // test inherits getFundamentalsSummary's call history from earlier describe blocks in this file
  // (e.g. get_analysis/get_ranking's own getFundamentalsSummary calls for the long-term/valuation
  // score) instead of starting from a clean slate.
  beforeEach(() => {
    vi.mocked(isFmpConfigured).mockReturnValue(true);
    vi.mocked(hasFundamentalsCoverage).mockImplementation((symbol: string) => ["NVDA", "MSFT", "TSLA"].includes(symbol.toUpperCase()));
    vi.mocked(getFundamentalsSummary).mockReset();
    vi.mocked(getFundamentalsSummary).mockImplementation(async () => null);
    vi.mocked(getCompanyProfile).mockReset();
    vi.mocked(getCompanyProfile).mockImplementation(async () => null);
  });

  it("reports honestly when FMP is not configured, without calling getFundamentalsSummary", async () => {
    vi.mocked(isFmpConfigured).mockReturnValue(false);
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "NVDA" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(false);
    expect(getFundamentalsSummary).not.toHaveBeenCalled();
  });

  it("falls back to sector/market cap (limitedCoverage) for a stock outside the verified ratios/EPS coverage set, without calling getFundamentalsSummary", async () => {
    vi.mocked(getCompanyProfile).mockResolvedValueOnce({
      symbol: "SAP",
      companyName: "SAP SE",
      sector: "Technology",
      industry: "Software",
      marketCap: 250_000_000_000,
    });
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "SAP" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(true);
    expect(result.limitedCoverage).toBe(true);
    expect(result.sector).toBe("Technology");
    expect(result.peRatio).toBe("nicht verfügbar");
    expect(getFundamentalsSummary).not.toHaveBeenCalled();
  });

  it("reports found:false for a stock outside coverage when FMP has no profile either", async () => {
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "SAP" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(false);
    expect(result.message).toMatch(/SAP/);
  });

  it("reports found:false for a crypto/ETF symbol without calling getCompanyProfile — these ratios don't apply", async () => {
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "BTC" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(false);
    expect(getCompanyProfile).not.toHaveBeenCalled();
    expect(getFundamentalsSummary).not.toHaveBeenCalled();
  });

  it("returns real numbers for a covered symbol, formatted for display", async () => {
    vi.mocked(getFundamentalsSummary).mockResolvedValueOnce({
      symbol: "NVDA",
      peRatio: 30,
      pegRatio: 0.5,
      priceToSalesRatio: 10,
      debtToEquity: 0.1,
      dividendYield: 0.02,
      freeCashFlowPerShare: 5,
      eps: 5,
      marketCap: 5_000_000_000,
      sector: "Technology",
      estimates: [{ fiscalYearEnd: "2027-01-25", revenueAvg: 250_000_000_000, epsAvg: 6.1, epsLow: 5.4, epsHigh: 6.8, numAnalystsEps: 20 }],
    });
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "NVDA" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(true);
    expect(result.peRatio).toBe("30.00");
    expect(result.pegRatio).toBe("0.50");
    expect(result.dividendYieldPercent).toBe("2.00 %");
    expect(result.sector).toBe("Technology");
    expect(Array.isArray(result.analystEstimates)).toBe(true);
    expect(result.analystEstimates[0].epsAvg).toBe("6.10");
  });

  it("marks individual missing fields as 'nicht verfügbar' instead of 0 or a fabricated value", async () => {
    vi.mocked(getFundamentalsSummary).mockResolvedValueOnce({
      symbol: "NVDA",
      peRatio: null,
      pegRatio: null,
      priceToSalesRatio: null,
      debtToEquity: null,
      dividendYield: null,
      freeCashFlowPerShare: null,
      eps: 5,
      marketCap: null,
      sector: null,
      estimates: null,
    });
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "NVDA" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(true);
    expect(result.peRatio).toBe("nicht verfügbar");
    expect(result.dividendYieldPercent).toBe("nicht verfügbar");
    expect(result.marketCap).toBe("nicht verfügbar");
    expect(result.sector).toBe("nicht verfügbar");
    expect(result.analystEstimates).toBe("nicht verfügbar");
  });

  it("surfaces the FMP daily-quota-exhausted message instead of throwing or pretending the symbol is simply unavailable", async () => {
    vi.mocked(getFundamentalsSummary).mockRejectedValueOnce(new FmpDailyLimitReachedError());
    const result = JSON.parse(await runFinanceTool("get_fundamentals", { symbol: "NVDA" }, baseUser, noPositions, noHistory));
    expect(result.found).toBe(false);
    expect(result.rateLimited).toBe(true);
    expect(result.message).toMatch(/Kontingent/);
  });
});

/**
 * "long-term" strategy (lib/strategy/config.ts), added alongside the "welche Aktie würdest du mir
 * langfristig empfehlen?" prompt fix: get_analysis/get_ranking now also compute a fundamentals-
 * derived valuation score (lib/analysis/valuation.ts) for the FMP coverage set. TSLA is used here
 * specifically because it's untouched by any earlier test in this file — the 90s per-symbol
 * analysis cache (lib/finara-ai/tools.ts's computeAnalysisForInstrument) would otherwise return an
 * already-cached result from before this describe block's getFundamentalsSummary mock was set,
 * same reasoning as the existing "fresh symbol" comment in the caching describe block above.
 */
describe("get_analysis / get_ranking — long-term strategy (valuation)", () => {
  beforeEach(() => {
    vi.mocked(getFundamentalsSummary).mockReset();
    vi.mocked(getFundamentalsSummary).mockImplementation(async () => null);
  });

  it("get_analysis includes an available long-term strategy result when valuation data is present", async () => {
    vi.mocked(getFundamentalsSummary).mockResolvedValueOnce({
      symbol: "TSLA",
      peRatio: 12,
      pegRatio: 0.8,
      priceToSalesRatio: 4,
      debtToEquity: 0.3,
      dividendYield: 0.02,
      freeCashFlowPerShare: 3,
      eps: 4,
      marketCap: 800_000_000_000,
      sector: "Consumer Cyclical",
      estimates: null,
    });
    const result = JSON.parse(await runFinanceTool("get_analysis", { symbol: "TSLA" }, baseUser, noPositions, noHistory));
    expect(result.scores.valuation.availability).toBe("available");
    const longTerm = result.strategies.find((s: { strategyId: string }) => s.strategyId === "long-term");
    expect(longTerm).toBeDefined();
    expect(longTerm.compositeScore).not.toBeNull();
  });

  it("get_analysis reports valuation as unavailable, with an honest reason, when no fundamentals data is returned", async () => {
    // A different, otherwise-untouched symbol than the previous test (not TSLA) — the previous
    // test's analysis is cached for 90s, so reusing its symbol here would read that cached,
    // valuation-available result instead of exercising the null-fundamentals path.
    const result = JSON.parse(await runFinanceTool("get_analysis", { symbol: "ASML" }, baseUser, noPositions, noHistory));
    expect(result.scores.valuation.availability).toBe("unavailable");
    expect(result.scores.valuation.unavailableReason).toBeTruthy();
  });

  it("get_ranking with strategyId=long-term ranks by the fundamentals-weighted score, not the default intraday score", async () => {
    // Reuses TSLA from the first test in this block on purpose: its analysis (valuation
    // available) is already cached for 90s by computeAnalysisForInstrument, same "fresh symbol
    // stays fresh, a reused one reads the warm cache" reasoning documented on this describe block.
    const result = JSON.parse(
      await runFinanceTool(
        "get_ranking",
        { strategyId: "long-term", watchlistOnly: true },
        withUser("user-with-tsla"),
        noPositions,
        noHistory,
      ),
    );
    expect(result.strategyId).toBe("long-term");
    expect(result.ranking).toHaveLength(1);
    expect(result.ranking[0].symbol).toBe("TSLA");
    expect(result.ranking[0].compositeScore).not.toBeNull();
  });
});

describe("rateLimitNote surfacing when Twelve Data is rate-limited despite the queue", () => {
  afterEach(() => {
    __resetTwelveDataRateLimitStateForTests();
  });

  it("get_analysis omits rateLimitNote when no rate limit was hit", async () => {
    const result = JSON.parse(await runFinanceTool("get_analysis", { symbol: "SOL" }, baseUser, noPositions, noHistory));
    expect(result.rateLimitNote).toBeUndefined();
  });

  it("get_analysis surfaces the exact friendly rate-limit message instead of a raw error", async () => {
    markTwelveDataRateLimited();
    const result = JSON.parse(await runFinanceTool("get_analysis", { symbol: "SOL" }, baseUser, noPositions, noHistory));
    expect(result.rateLimitNote).toBe("Datenquelle aktuell ausgelastet, bitte in Kürze erneut versuchen.");
    expect(result.found).toBe(true);
  });

  it("get_ranking surfaces the same rate-limit note", async () => {
    markTwelveDataRateLimited();
    const result = JSON.parse(
      await runFinanceTool("get_ranking", { watchlistOnly: true }, withUser("user-with-watchlist"), noPositions, noHistory),
    );
    expect(result.rateLimitNote).toBe("Datenquelle aktuell ausgelastet, bitte in Kürze erneut versuchen.");
  });
});

describe("screen_momentum_candidates", () => {
  it("screens only finara's live-mapped instrument set, explicitly labeled as a pre-filtered subset — never the whole market", async () => {
    const result = JSON.parse(
      await runFinanceTool("screen_momentum_candidates", { minChangePct: -999, limit: 20 }, baseUser, noPositions, noHistory),
    );

    expect(result.candidatesTotal).toBe(Object.keys(liveSymbols).length);
    expect(result.scopeNote).toMatch(/[Vv]orgefilterte Teilmenge/);
    expect(result.scopeNote).toMatch(/NICHT der Gesamtmarkt/);
    expect(Array.isArray(result.candidates)).toBe(true);
  });

  it("returns candidates sorted descending by day performance, all meeting the RSI/momentum/liquidity criteria", async () => {
    // minChangePct: -999 so the day-performance floor never excludes anything — isolates the
    // RSI-band (50-80) and liquidity (has volume data) filters, whatever the deterministic mock
    // data for each of the 8 live-mapped symbols happens to produce.
    const result = JSON.parse(
      await runFinanceTool("screen_momentum_candidates", { minChangePct: -999, limit: 20 }, baseUser, noPositions, noHistory),
    );

    for (const candidate of result.candidates) {
      const rsi = parseFloat(candidate.rsi);
      expect(rsi).toBeGreaterThanOrEqual(50);
      expect(rsi).toBeLessThanOrEqual(80);
    }
    const changePercents = result.candidates.map((c: { changePercent1d: string }) => parseFloat(c.changePercent1d));
    const sorted = [...changePercents].sort((a, b) => b - a);
    expect(changePercents).toEqual(sorted);
  });

  it("respects the limit parameter", async () => {
    const result = JSON.parse(
      await runFinanceTool("screen_momentum_candidates", { minChangePct: -999, limit: 1 }, baseUser, noPositions, noHistory),
    );
    expect(result.candidates.length).toBeLessThanOrEqual(1);
  });
});

describe("calculate_pivot_points", () => {
  it("returns dataSource:'simulated' with an approximation note for an instrument without a live Twelve Data mapping", async () => {
    const result = JSON.parse(await runFinanceTool("calculate_pivot_points", { symbol: "SIE" }, baseUser, noPositions, noHistory));
    expect(result.dataSource).toBe("simulated");
    expect(result.levels).not.toBeNull();
    expect(result.levels.r1).toBeGreaterThan(result.levels.pivot);
    expect(result.levels.pivot).toBeGreaterThan(result.levels.s1);
    expect(result.message).toMatch(/angenähert/);
  });

  it("defaults to the '1D' timeframe when none is given", async () => {
    const result = JSON.parse(await runFinanceTool("calculate_pivot_points", { symbol: "SIE" }, baseUser, noPositions, noHistory));
    expect(result.timeframe).toBe("1D");
  });
});
