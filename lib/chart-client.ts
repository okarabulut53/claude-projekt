import { CandleDatum } from "@/components/charts/CandlestickChart";

export interface ChartApiResult {
  ok: boolean;
  candles: CandleDatum[] | null;
  quote: { price: number; changePercent1d: number } | null;
  message?: string;
}

/** Client-side fetch against app/api/chart/[symbol]/route.ts — shared by every chart that lets the user switch intervals. */
export async function fetchChartData(symbol: string, interval: string, outputsize = 200): Promise<ChartApiResult> {
  try {
    const res = await fetch(`/api/chart/${symbol}?interval=${interval}&outputsize=${outputsize}`);
    const body = await res.json();
    return { ok: res.ok, candles: body.candles ?? null, quote: body.quote ?? null, message: body.message };
  } catch {
    return { ok: false, candles: null, quote: null, message: "Kursdaten konnten nicht geladen werden." };
  }
}
