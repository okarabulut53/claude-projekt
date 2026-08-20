import { cached } from "@/lib/market-data/cache";
import { reserveFmpDailyRequest } from "@/lib/market-data/rateLimitQueue";

export { FmpDailyLimitReachedError } from "@/lib/market-data/rateLimitQueue";

const FMP_KEY = process.env.FMP_DATA_API_KEY;
const BASE = "https://financialmodelingprep.com/stable";

export function isFmpConfigured() {
  return Boolean(FMP_KEY);
}

/**
 * Symbols verified (2026-08-20, by calling the endpoints directly with finara's own FMP key) to
 * actually return data from the ratios-ttm/key-metrics-ttm/income-statement/cash-flow-statement/
 * analyst-estimates endpoints below on the current plan. FMP's `profile` endpoint answers for
 * every finara stock symbol including SAP/ASML, but the fundamentals endpoints return a "Premium
 * Query Parameter" error for anything outside this set — SAP and ASML included, despite both
 * having live PRICE coverage via Finnhub/Twelve Data (see lib/market-data/symbols.ts, a separate,
 * unrelated coverage question). Crypto (BTC/ETH/SOL) and the UCITS ETFs (IUSA/EXW1/VWCE) are
 * deliberately excluded outright, not just untested — P/E, PEG, and dividend yield don't apply to
 * a cryptocurrency, and FMP has no fund-level fundamentals for these ETFs on any plan. Re-verify
 * this list against the live endpoints if finara's FMP plan ever changes.
 */
const FUNDAMENTALS_COVERED_SYMBOLS = new Set(["NVDA", "MSFT", "TSLA"]);

export function hasFundamentalsCoverage(symbol: string): boolean {
  return FUNDAMENTALS_COVERED_SYMBOLS.has(symbol.toUpperCase());
}

async function fmpGet<T>(path: string, params: Record<string, string>): Promise<T[] | null> {
  if (!FMP_KEY) return null;
  reserveFmpDailyRequest(); // throws FmpDailyLimitReachedError once the 250/day quota is used up
  const query = new URLSearchParams({ ...params, apikey: FMP_KEY }).toString();
  try {
    const res = await fetch(`${BASE}/${path}?${query}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as T[];
  } catch {
    return null;
  }
}

export interface FmpFundamentals {
  symbol: string;
  fiscalYear: string;
  eps: number;
  epsDiluted: number;
  freeCashFlow: number;
}

interface FmpIncomeStatementRow {
  date: string;
  eps: number;
  epsDiluted: number;
}

interface FmpCashFlowRow {
  freeCashFlow: number;
}

/**
 * EPS + free cash flow from the most recent annual filing (income-statement /
 * cash-flow-statement, period=annual, limit=1) — not TTM, since FMP has no plain per-share TTM
 * EPS field on this plan (only derivable indirectly via ratios-ttm's priceToEarningsRatioTTM).
 * Returns null if FMP is unconfigured, `ticker` isn't in FUNDAMENTALS_COVERED_SYMBOLS, or either
 * request fails — callers must treat null as "not available", not retry inline.
 */
export async function getFundamentals(ticker: string): Promise<FmpFundamentals | null> {
  const symbol = ticker.toUpperCase();
  if (!hasFundamentalsCoverage(symbol)) return null;

  return cached(`fmp:fundamentals:${symbol}`, 6 * 3600_000, async () => {
    const [income, cashFlow] = await Promise.all([
      fmpGet<FmpIncomeStatementRow>("income-statement", { symbol, period: "annual", limit: "1" }),
      fmpGet<FmpCashFlowRow>("cash-flow-statement", { symbol, period: "annual", limit: "1" }),
    ]);
    if (!income || !cashFlow) return null;

    return {
      symbol,
      fiscalYear: income[0].date.slice(0, 4),
      eps: income[0].eps,
      epsDiluted: income[0].epsDiluted,
      freeCashFlow: cashFlow[0].freeCashFlow,
    };
  });
}

export interface FmpRatios {
  symbol: string;
  peRatioTTM: number;
  pegRatioTTM: number;
  priceToSalesRatioTTM: number;
  dividendYieldTTM: number;
  dividendPerShareTTM: number;
  debtToEquityTTM: number;
  interestCoverageTTM: number;
  freeCashFlowPerShareTTM: number;
  /** Not part of the original (2026-08-20) endpoint verification pass — same "ratios-ttm" call as
   *  the other fields above, but currentRatioTTM/returnOnEquityTTM haven't been individually
   *  confirmed present on this plan. Same fail-open behavior as everywhere else in this file: an
   *  unexpectedly missing/undefined field just becomes null ("nicht verfügbar") here rather than
   *  breaking the call, so an unverified field name degrades safely instead of fabricating 0. */
  currentRatioTTM: number | null;
  returnOnEquityTTM: number | null;
}

interface FmpRatiosTtmRow {
  symbol: string;
  priceToEarningsRatioTTM: number;
  priceToEarningsGrowthRatioTTM: number;
  priceToSalesRatioTTM: number;
  dividendYieldTTM: number;
  dividendPerShareTTM: number;
  debtToEquityRatioTTM: number;
  interestCoverageRatioTTM: number;
  freeCashFlowPerShareTTM: number;
  currentRatioTTM?: number;
  returnOnEquityTTM?: number;
}

/** KGV, PEG, KUV, Dividendenrendite, Verschuldungsgrad, Zinsdeckung, FCF je Aktie, Current Ratio,
 *  Eigenkapitalrendite (ratios-ttm). Null under the same conditions as getFundamentals. */
export async function getRatios(ticker: string): Promise<FmpRatios | null> {
  const symbol = ticker.toUpperCase();
  if (!hasFundamentalsCoverage(symbol)) return null;

  return cached(`fmp:ratios:${symbol}`, 6 * 3600_000, async () => {
    const rows = await fmpGet<FmpRatiosTtmRow>("ratios-ttm", { symbol });
    if (!rows) return null;
    const r = rows[0];
    return {
      symbol,
      peRatioTTM: r.priceToEarningsRatioTTM,
      pegRatioTTM: r.priceToEarningsGrowthRatioTTM,
      priceToSalesRatioTTM: r.priceToSalesRatioTTM,
      dividendYieldTTM: r.dividendYieldTTM,
      dividendPerShareTTM: r.dividendPerShareTTM,
      debtToEquityTTM: r.debtToEquityRatioTTM,
      interestCoverageTTM: r.interestCoverageRatioTTM,
      freeCashFlowPerShareTTM: r.freeCashFlowPerShareTTM,
      currentRatioTTM: r.currentRatioTTM ?? null,
      returnOnEquityTTM: r.returnOnEquityTTM ?? null,
    };
  });
}

export interface FmpMarginHistoryRow {
  fiscalYear: string;
  revenue: number;
  grossMarginPct: number | null;
  operatingMarginPct: number | null;
  netMarginPct: number | null;
}

interface FmpIncomeStatementHistoryRow {
  date: string;
  revenue: number;
  grossProfitRatio?: number;
  operatingIncomeRatio?: number;
  netIncomeRatio?: number;
}

/** Multi-year revenue + margin trend (income-statement, period=annual) for the Standard-
 *  Analysebericht's margin/revenue table+chart. Same coverage gate and null-safety as
 *  getFundamentals. */
export async function getMarginHistory(ticker: string, years = 5): Promise<FmpMarginHistoryRow[] | null> {
  const symbol = ticker.toUpperCase();
  if (!hasFundamentalsCoverage(symbol)) return null;

  return cached(`fmp:margin-history:${symbol}:${years}`, 6 * 3600_000, async () => {
    const rows = await fmpGet<FmpIncomeStatementHistoryRow>("income-statement", { symbol, period: "annual", limit: String(years) });
    if (!rows) return null;
    const toPct = (ratio: number | undefined) => (typeof ratio === "number" ? Math.round(ratio * 100 * 100) / 100 : null);
    return rows
      .map((r) => ({
        fiscalYear: r.date.slice(0, 4),
        revenue: r.revenue,
        grossMarginPct: toPct(r.grossProfitRatio),
        operatingMarginPct: toPct(r.operatingIncomeRatio),
        netMarginPct: toPct(r.netIncomeRatio),
      }))
      .reverse(); // oldest first, for a left-to-right trend chart
  });
}

export interface FmpEarningsSurprise {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
}

interface FmpEarningsSurpriseRow {
  date: string;
  actualEarningResult?: number;
  estimatedEarning?: number;
}

/**
 * Most recent reported EPS actual-vs-estimate (earnings-surprises, no explicit period param on
 * this endpoint). UNLIKE the endpoints above, this one has NOT been empirically verified against
 * finara's live FMP key/plan (see the coverage-verification comment on FUNDAMENTALS_COVERED_SYMBOLS
 * at the top of this file — that pass covered ratios-ttm/income-statement/cash-flow-statement/
 * analyst-estimates, not this endpoint). Coded defensively for that reason: any missing/renamed
 * field or an outright request failure both degrade to null ("nicht verfügbar" at the caller),
 * never a fabricated number.
 */
export async function getEarningsSurprises(ticker: string): Promise<FmpEarningsSurprise | null> {
  const symbol = ticker.toUpperCase();
  if (!hasFundamentalsCoverage(symbol)) return null;

  return cached(`fmp:earnings-surprises:${symbol}`, 6 * 3600_000, async () => {
    const rows = await fmpGet<FmpEarningsSurpriseRow>("earnings-surprises", { symbol, limit: "1" });
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    const epsActual = typeof r.actualEarningResult === "number" ? r.actualEarningResult : null;
    const epsEstimate = typeof r.estimatedEarning === "number" ? r.estimatedEarning : null;
    const surprisePct = epsActual !== null && epsEstimate !== null && epsEstimate !== 0 ? ((epsActual - epsEstimate) / Math.abs(epsEstimate)) * 100 : null;
    return { date: r.date, epsActual, epsEstimate, surprisePct };
  });
}

export interface FmpCompanyProfile {
  symbol: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
}

interface FmpProfileRow {
  symbol: string;
  companyName: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
}

/**
 * Company profile (Sektor/Branche/Marktkapitalisierung) — unlike getFundamentals/getRatios/
 * getAnalystEstimates, deliberately NOT gated by FUNDAMENTALS_COVERED_SYMBOLS: FMP's /profile
 * endpoint answers for every finara stock symbol on the current plan (verified live for SAP and
 * NVDA, 2026-08-20) — only the deeper fundamentals endpoints are plan-restricted. Kept as its own
 * function (not folded into getFundamentalsSummary) so a future sector-classification feature
 * (see lib/finara-ai/tools.ts's get_watchlist dataGaps note) can call it for symbols outside the
 * ratios/income-statement coverage set.
 */
export async function getCompanyProfile(ticker: string): Promise<FmpCompanyProfile | null> {
  const symbol = ticker.toUpperCase();
  return cached(`fmp:profile:${symbol}`, 6 * 3600_000, async () => {
    const rows = await fmpGet<FmpProfileRow>("profile", { symbol });
    if (!rows) return null;
    const r = rows[0];
    return {
      symbol,
      companyName: r.companyName,
      sector: r.sector ?? null,
      industry: r.industry ?? null,
      marketCap: r.marketCap ?? null,
    };
  });
}

export interface FmpAnalystEstimate {
  fiscalYearEnd: string;
  revenueAvg: number;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  numAnalystsEps: number;
}

interface FmpAnalystEstimateRow {
  date: string;
  revenueAvg: number;
  epsAvg: number;
  epsLow: number;
  epsHigh: number;
  numAnalystsEps: number;
}

/** Consensus revenue/EPS estimates for the next few fiscal years (analyst-estimates,
 *  period=annual). Null under the same conditions as getFundamentals. */
export async function getAnalystEstimates(ticker: string): Promise<FmpAnalystEstimate[] | null> {
  const symbol = ticker.toUpperCase();
  if (!hasFundamentalsCoverage(symbol)) return null;

  return cached(`fmp:estimates:${symbol}`, 6 * 3600_000, async () => {
    const rows = await fmpGet<FmpAnalystEstimateRow>("analyst-estimates", {
      symbol,
      period: "annual",
      page: "0",
      limit: "4",
    });
    if (!rows) return null;
    return rows.map((r) => ({
      fiscalYearEnd: r.date,
      revenueAvg: r.revenueAvg,
      epsAvg: r.epsAvg,
      epsLow: r.epsLow,
      epsHigh: r.epsHigh,
      numAnalystsEps: r.numAnalystsEps,
    }));
  });
}

export interface FmpFundamentalsSummary {
  symbol: string;
  peRatio: number | null;
  pegRatio: number | null;
  priceToSalesRatio: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
  freeCashFlowPerShare: number | null;
  eps: number | null;
  marketCap: number | null;
  sector: string | null;
  estimates: FmpAnalystEstimate[] | null;
}

/**
 * Combines getFundamentals/getRatios/getCompanyProfile/getAnalystEstimates into the single
 * unified shape lib/finara-ai/tools.ts's get_fundamentals tool presents to FinaraAI — KGV, PEG,
 * KUV, Verschuldungsgrad, Dividendenrendite, freier Cashflow je Aktie, EPS, Marktkapitalisierung,
 * Sektor, plus forward consensus estimates for growth-related questions ("EPS-Wachstum" etc.).
 * Each of the 4 underlying calls is independently cached (6h) and gated by
 * FUNDAMENTALS_COVERED_SYMBOLS except getCompanyProfile — so a single field missing from one
 * provider response doesn't blank out the rest; the field itself is null (callers render that as
 * "nicht verfügbar", never as 0 or a guess). Returns null outright only when the symbol isn't in
 * the verified coverage set at all.
 */
export async function getFundamentalsSummary(ticker: string): Promise<FmpFundamentalsSummary | null> {
  const symbol = ticker.toUpperCase();
  if (!isFmpConfigured() || !hasFundamentalsCoverage(symbol)) return null;

  const [fundamentals, ratios, profile, estimates] = await Promise.all([
    getFundamentals(symbol),
    getRatios(symbol),
    getCompanyProfile(symbol),
    getAnalystEstimates(symbol),
  ]);

  return {
    symbol,
    peRatio: ratios?.peRatioTTM ?? null,
    pegRatio: ratios?.pegRatioTTM ?? null,
    priceToSalesRatio: ratios?.priceToSalesRatioTTM ?? null,
    debtToEquity: ratios?.debtToEquityTTM ?? null,
    dividendYield: ratios?.dividendYieldTTM ?? null,
    freeCashFlowPerShare: ratios?.freeCashFlowPerShareTTM ?? null,
    eps: fundamentals?.eps ?? null,
    marketCap: profile?.marketCap ?? null,
    sector: profile?.sector ?? null,
    estimates: estimates ?? null,
  };
}
