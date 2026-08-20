import { afterEach, describe, expect, it, vi } from "vitest";

/** Every test re-imports the module fresh (vi.resetModules) because FMP_KEY is captured once at
 *  module load time from process.env — a test that flips the env var after import wouldn't see
 *  isFmpConfigured() change otherwise. This also gives each test a clean lib/market-data/cache.ts
 *  cache (its store is a module-level Map, reset along with everything else). */
async function importFresh() {
  vi.resetModules();
  return import("./fmp");
}

const originalKey = process.env.FMP_DATA_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.FMP_DATA_API_KEY;
  else process.env.FMP_DATA_API_KEY = originalKey;
});

describe("isFmpConfigured", () => {
  it("is false without an API key", async () => {
    delete process.env.FMP_DATA_API_KEY;
    const { isFmpConfigured } = await importFresh();
    expect(isFmpConfigured()).toBe(false);
  });

  it("is true once an API key is set", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    const { isFmpConfigured } = await importFresh();
    expect(isFmpConfigured()).toBe(true);
  });
});

describe("hasFundamentalsCoverage", () => {
  it("covers the empirically-verified free-plan symbols, case-insensitively", async () => {
    const { hasFundamentalsCoverage } = await importFresh();
    expect(hasFundamentalsCoverage("NVDA")).toBe(true);
    expect(hasFundamentalsCoverage("nvda")).toBe(true);
    expect(hasFundamentalsCoverage("MSFT")).toBe(true);
    expect(hasFundamentalsCoverage("TSLA")).toBe(true);
  });

  it("excludes symbols confirmed NOT covered on the free plan, even though they have live price data via Finnhub/Twelve Data", async () => {
    const { hasFundamentalsCoverage } = await importFresh();
    expect(hasFundamentalsCoverage("SAP")).toBe(false);
    expect(hasFundamentalsCoverage("ASML")).toBe(false);
  });

  it("excludes crypto and UCITS ETFs — fundamentals ratios don't apply to them", async () => {
    const { hasFundamentalsCoverage } = await importFresh();
    expect(hasFundamentalsCoverage("BTC")).toBe(false);
    expect(hasFundamentalsCoverage("VWCE")).toBe(false);
  });
});

describe("getFundamentals / getRatios / getAnalystEstimates / getCompanyProfile / getFundamentalsSummary — unconfigured / uncovered", () => {
  it("return null when FMP is unconfigured, without calling fetch", async () => {
    delete process.env.FMP_DATA_API_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { getFundamentals, getRatios, getAnalystEstimates, getCompanyProfile, getFundamentalsSummary } = await importFresh();

    expect(await getFundamentals("NVDA")).toBeNull();
    expect(await getRatios("NVDA")).toBeNull();
    expect(await getAnalystEstimates("NVDA")).toBeNull();
    expect(await getCompanyProfile("NVDA")).toBeNull();
    expect(await getFundamentalsSummary("NVDA")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("return null for a symbol outside the verified coverage set, without calling fetch", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { getFundamentals, getRatios, getAnalystEstimates, getFundamentalsSummary } = await importFresh();

    expect(await getFundamentals("SAP")).toBeNull();
    expect(await getRatios("SAP")).toBeNull();
    expect(await getAnalystEstimates("SAP")).toBeNull();
    expect(await getFundamentalsSummary("SAP")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("getCompanyProfile, unlike the others, still calls fetch for a symbol outside the coverage set (profile isn't plan-restricted)", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => [{ symbol: "SAP", companyName: "SAP SE", sector: "Technology", industry: "Software", marketCap: 253077425269 }],
    }));
    vi.stubGlobal("fetch", fetchSpy);
    const { getCompanyProfile } = await importFresh();

    expect(await getCompanyProfile("SAP")).toEqual({
      symbol: "SAP",
      companyName: "SAP SE",
      sector: "Technology",
      industry: "Software",
      marketCap: 253077425269,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("getFundamentalsSummary — merges ratios/fundamentals/profile/estimates", () => {
  it("combines all four sources into one result", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("ratios-ttm")) {
          return {
            ok: true,
            json: async () => [
              {
                symbol: "NVDA",
                priceToEarningsRatioTTM: 32.895,
                priceToEarningsGrowthRatioTTM: 0.302,
                priceToSalesRatioTTM: 20.674,
                dividendYieldTTM: 0.0013,
                dividendPerShareTTM: 0.28,
                debtToEquityRatioTTM: 0.0656,
                interestCoverageRatioTTM: 544.58,
                freeCashFlowPerShareTTM: 4.903,
              },
            ],
          };
        }
        if (url.includes("income-statement")) {
          return { ok: true, json: async () => [{ date: "2026-01-25", eps: 4.93, epsDiluted: 4.9 }] };
        }
        if (url.includes("cash-flow-statement")) {
          return { ok: true, json: async () => [{ freeCashFlow: 96676000000 }] };
        }
        if (url.includes("profile")) {
          return { ok: true, json: async () => [{ symbol: "NVDA", companyName: "NVIDIA Corp.", sector: "Technology", industry: "Semiconductors", marketCap: 5241182190000 }] };
        }
        if (url.includes("analyst-estimates")) {
          return { ok: true, json: async () => [{ date: "2027-01-25", revenueAvg: 250000000000, epsAvg: 6.1, epsLow: 5.4, epsHigh: 6.8, numAnalystsEps: 20 }] };
        }
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { getFundamentalsSummary } = await importFresh();

    expect(await getFundamentalsSummary("NVDA")).toEqual({
      symbol: "NVDA",
      peRatio: 32.895,
      pegRatio: 0.302,
      priceToSalesRatio: 20.674,
      debtToEquity: 0.0656,
      dividendYield: 0.0013,
      freeCashFlowPerShare: 4.903,
      eps: 4.93,
      marketCap: 5241182190000,
      sector: "Technology",
      estimates: [{ fiscalYearEnd: "2027-01-25", revenueAvg: 250000000000, epsAvg: 6.1, epsLow: 5.4, epsHigh: 6.8, numAnalystsEps: 20 }],
    });
  });

  it("nulls out only the fields whose underlying source failed, instead of failing the whole summary", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("ratios-ttm")) return { ok: false, json: async () => ({}) };
        if (url.includes("income-statement")) return { ok: true, json: async () => [{ date: "2026-01-25", eps: 4.93, epsDiluted: 4.9 }] };
        if (url.includes("cash-flow-statement")) return { ok: true, json: async () => [{ freeCashFlow: 96676000000 }] };
        if (url.includes("profile")) return { ok: false, json: async () => ({}) };
        if (url.includes("analyst-estimates")) return { ok: false, json: async () => ({}) };
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { getFundamentalsSummary } = await importFresh();

    expect(await getFundamentalsSummary("NVDA")).toEqual({
      symbol: "NVDA",
      peRatio: null,
      pegRatio: null,
      priceToSalesRatio: null,
      debtToEquity: null,
      dividendYield: null,
      freeCashFlowPerShare: null,
      eps: 4.93,
      marketCap: null,
      sector: null,
      estimates: null,
    });
  });
});

describe("FMP daily request quota (250/day free tier)", () => {
  it("throws FmpDailyLimitReachedError once the daily quota is exhausted, without caching a false 'not available' result", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ symbol: "X", companyName: "X Inc." }] })),
    );
    const { getCompanyProfile, FmpDailyLimitReachedError } = await importFresh();

    // getCompanyProfile isn't gated by FUNDAMENTALS_COVERED_SYMBOLS, so 250 distinct fake tickers
    // give 250 distinct lib/market-data/cache.ts cache keys — exhausting the quota for real instead
    // of hitting the per-symbol cache after the first call.
    for (let i = 0; i < 250; i++) {
      await getCompanyProfile(`FAKE${i}`);
    }

    await expect(getCompanyProfile("FAKE250")).rejects.toBeInstanceOf(FmpDailyLimitReachedError);

    // The failed 251st call must NOT have been cached as a "not available" result — retrying the
    // same symbol keeps throwing (not silently resolving to null) until the quota resets.
    await expect(getCompanyProfile("FAKE250")).rejects.toBeInstanceOf(FmpDailyLimitReachedError);
  });
});

describe("getFundamentals — real response shape", () => {
  it("merges income-statement and cash-flow-statement into one result", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("income-statement")) {
          return { ok: true, json: async () => [{ date: "2026-01-25", eps: 4.93, epsDiluted: 4.9 }] };
        }
        if (url.includes("cash-flow-statement")) {
          return { ok: true, json: async () => [{ freeCashFlow: 96676000000 }] };
        }
        throw new Error(`unexpected url: ${url}`);
      }),
    );
    const { getFundamentals } = await importFresh();
    expect(await getFundamentals("NVDA")).toEqual({
      symbol: "NVDA",
      fiscalYear: "2026",
      eps: 4.93,
      epsDiluted: 4.9,
      freeCashFlow: 96676000000,
    });
  });
});

describe("getRatios — real response shape", () => {
  it("maps ratios-ttm's field names to FmpRatios", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            symbol: "NVDA",
            priceToEarningsRatioTTM: 32.895,
            priceToEarningsGrowthRatioTTM: 0.302,
            priceToSalesRatioTTM: 20.674,
            dividendYieldTTM: 0.0013,
            dividendPerShareTTM: 0.28,
            debtToEquityRatioTTM: 0.0656,
            interestCoverageRatioTTM: 544.58,
            freeCashFlowPerShareTTM: 4.903,
            currentRatioTTM: 4.2,
            returnOnEquityTTM: 0.91,
          },
        ],
      })),
    );
    const { getRatios } = await importFresh();
    expect(await getRatios("NVDA")).toEqual({
      symbol: "NVDA",
      peRatioTTM: 32.895,
      pegRatioTTM: 0.302,
      priceToSalesRatioTTM: 20.674,
      dividendYieldTTM: 0.0013,
      dividendPerShareTTM: 0.28,
      debtToEquityTTM: 0.0656,
      interestCoverageTTM: 544.58,
      freeCashFlowPerShareTTM: 4.903,
      currentRatioTTM: 4.2,
      returnOnEquityTTM: 0.91,
    });
  });

  it("degrades currentRatioTTM/returnOnEquityTTM to null when the endpoint doesn't include them, without breaking the other fields", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            symbol: "NVDA",
            priceToEarningsRatioTTM: 32.895,
            priceToEarningsGrowthRatioTTM: 0.302,
            priceToSalesRatioTTM: 20.674,
            dividendYieldTTM: 0.0013,
            dividendPerShareTTM: 0.28,
            debtToEquityRatioTTM: 0.0656,
            interestCoverageRatioTTM: 544.58,
            freeCashFlowPerShareTTM: 4.903,
          },
        ],
      })),
    );
    const { getRatios } = await importFresh();
    const result = await getRatios("NVDA");
    expect(result?.currentRatioTTM).toBeNull();
    expect(result?.returnOnEquityTTM).toBeNull();
    expect(result?.peRatioTTM).toBe(32.895);
  });

  it("returns null when FMP responds with a plan-restriction error object instead of an array", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ "Error Message": "Premium Query Parameter" }),
      })),
    );
    const { getRatios } = await importFresh();
    expect(await getRatios("NVDA")).toBeNull();
  });

  it("returns null when the HTTP response itself is not ok (e.g. invalid API key)", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ "Error Message": "Invalid API KEY." }),
      })),
    );
    const { getRatios } = await importFresh();
    expect(await getRatios("NVDA")).toBeNull();
  });
});

describe("getMarginHistory — multi-year margin/revenue trend", () => {
  it("maps income-statement rows to FmpMarginHistoryRow[], oldest fiscal year first, percentages not raw ratios", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        // FMP returns newest-first — the transformation must reverse this for a left-to-right
        // trend chart/table.
        json: async () => [
          { date: "2027-09-30", revenue: 400_000_000_000, grossProfitRatio: 0.47, operatingIncomeRatio: 0.31, netIncomeRatio: 0.26 },
          { date: "2026-09-30", revenue: 350_000_000_000, grossProfitRatio: 0.45, operatingIncomeRatio: 0.29, netIncomeRatio: 0.24 },
        ],
      })),
    );
    const { getMarginHistory } = await importFresh();

    const result = await getMarginHistory("NVDA", 2);

    expect(result).toEqual([
      { fiscalYear: "2026", revenue: 350_000_000_000, grossMarginPct: 45, operatingMarginPct: 29, netMarginPct: 24 },
      { fiscalYear: "2027", revenue: 400_000_000_000, grossMarginPct: 47, operatingMarginPct: 31, netMarginPct: 26 },
    ]);
  });

  it("degrades a single missing margin field to null instead of fabricating or omitting the whole row", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [{ date: "2027-09-30", revenue: 400_000_000_000, grossProfitRatio: 0.47 }],
      })),
    );
    const { getMarginHistory } = await importFresh();

    const result = await getMarginHistory("NVDA", 1);

    expect(result).toEqual([{ fiscalYear: "2027", revenue: 400_000_000_000, grossMarginPct: 47, operatingMarginPct: null, netMarginPct: null }]);
  });

  it("returns null for a symbol outside the verified fundamentals coverage set, without calling fetch", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { getMarginHistory } = await importFresh();

    expect(await getMarginHistory("SAP")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getAnalystEstimates — real response shape", () => {
  it("maps analyst-estimates rows to FmpAnalystEstimate[]", async () => {
    process.env.FMP_DATA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            date: "2031-01-25",
            revenueAvg: 1005000000000,
            epsAvg: 20,
            epsHigh: 23.94624,
            epsLow: 15.65321,
            numAnalystsEps: 12,
          },
        ],
      })),
    );
    const { getAnalystEstimates } = await importFresh();
    expect(await getAnalystEstimates("NVDA")).toEqual([
      {
        fiscalYearEnd: "2031-01-25",
        revenueAvg: 1005000000000,
        epsAvg: 20,
        epsLow: 15.65321,
        epsHigh: 23.94624,
        numAnalystsEps: 12,
      },
    ]);
  });
});
