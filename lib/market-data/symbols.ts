/**
 * Maps this app's internal symbols to the tickers Finnhub/Twelve Data expect,
 * for the subset of instruments verified to have real free-tier coverage.
 *
 * Deliberately NOT included: SIE/ALV/DTE (only trade OTC as ADRs with
 * unverified conversion ratios — showing that price mislabeled as the XETRA
 * share price would be misleading) and IUSA/EXW1/VWCE (UCITS ETFs aren't
 * covered by either provider's free tier). Those stay on deterministic mock
 * data rather than risk showing a wrong number for a real instrument.
 */
export interface LiveSymbolMap {
  finnhub: string;
  twelveData: string;
  /** Live quotes for these symbols come back in USD even though the app's mock seed lists some in EUR. */
  currency: "USD";
}

export const liveSymbols: Record<string, LiveSymbolMap> = {
  SAP: { finnhub: "SAP", twelveData: "SAP", currency: "USD" },
  NVDA: { finnhub: "NVDA", twelveData: "NVDA", currency: "USD" },
  MSFT: { finnhub: "MSFT", twelveData: "MSFT", currency: "USD" },
  TSLA: { finnhub: "TSLA", twelveData: "TSLA", currency: "USD" },
  ASML: { finnhub: "ASML", twelveData: "ASML", currency: "USD" },
  BTC: { finnhub: "BINANCE:BTCUSDT", twelveData: "BTC/USD", currency: "USD" },
  ETH: { finnhub: "BINANCE:ETHUSDT", twelveData: "ETH/USD", currency: "USD" },
  SOL: { finnhub: "BINANCE:SOLUSDT", twelveData: "SOL/USD", currency: "USD" },
};
