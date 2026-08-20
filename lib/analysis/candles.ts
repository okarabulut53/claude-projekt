import { CandleDatum } from "@/components/charts/CandlestickChart";
import { PricePoint } from "@/lib/types";

/** Only close-price history is available for every instrument (live and simulated alike — see
 *  Instrument.history), not full intraday OHLCV. Reusing lib/indicators.ts's indicator functions
 *  (which only ever read `.close`/`.high`/`.low`, verified by inspection) on a synthetic bar with
 *  open=high=low=close=price is honest about that: it doesn't fabricate an intrabar range like
 *  the chart's syntheticCandlesFromPricePoints does for visual purposes, and it lets the
 *  Analysis Layer reuse the same tested indicator math the charts use instead of a second,
 *  independently-maintained implementation. `volume` is carried through when present (see
 *  PricePoint.volume) so volume-based indicators/scores can use it; indicators that only read
 *  open/high/low/close are unaffected either way. */
export function toCloseOnlyCandles(history: PricePoint[]): CandleDatum[] {
  return history.map((p) => ({ time: p.date, open: p.price, high: p.price, low: p.price, close: p.price, volume: p.volume ?? 0 }));
}
