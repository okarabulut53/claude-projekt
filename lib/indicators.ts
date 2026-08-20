import { CandleDatum } from "@/components/charts/CandlestickChart";

export interface IndicatorPoint {
  time: string | number;
  value: number;
}

export function sma(data: CandleDatum[], period: number): IndicatorPoint[] {
  const points: IndicatorPoint[] = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) points.push({ time: data[i].time, value: sum / period });
  }
  return points;
}

export function ema(data: CandleDatum[], period: number): IndicatorPoint[] {
  const points: IndicatorPoint[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < data.length; i++) {
    const close = data[i].close;
    if (prev === null) {
      if (i === period - 1) {
        const seed = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
        prev = seed;
        points.push({ time: data[i].time, value: seed });
      }
      continue;
    }
    prev = close * k + prev * (1 - k);
    points.push({ time: data[i].time, value: prev });
  }
  return points;
}

export interface BollingerBands {
  upper: IndicatorPoint[];
  middle: IndicatorPoint[];
  lower: IndicatorPoint[];
}

export function bollingerBands(data: CandleDatum[], period = 20, stdDevMultiplier = 2): BollingerBands {
  const middle = sma(data, period);
  const upper: IndicatorPoint[] = [];
  const lower: IndicatorPoint[] = [];

  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    const mean = window.reduce((sum, d) => sum + d.close, 0) / period;
    const variance = window.reduce((sum, d) => sum + (d.close - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    upper.push({ time: data[i].time, value: mean + stdDev * stdDevMultiplier });
    lower.push({ time: data[i].time, value: mean - stdDev * stdDevMultiplier });
  }

  return { upper, middle, lower };
}

/** Wilder's RSI — the standard formula used by most charting platforms. */
export function rsi(data: CandleDatum[], period = 14): IndicatorPoint[] {
  if (data.length <= period) return [];
  const points: IndicatorPoint[] = [];

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  points.push({ time: data[period].time, value: rsiFromAverages(avgGain, avgLoss) });

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    points.push({ time: data[i].time, value: rsiFromAverages(avgGain, avgLoss) });
  }

  return points;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd: IndicatorPoint[];
  signal: IndicatorPoint[];
  histogram: IndicatorPoint[];
}

/** Standard MACD(12, 26, 9): fast EMA minus slow EMA, plus a signal EMA of that line. */
export function macd(data: CandleDatum[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(data, fast);
  const slowEma = ema(data, slow);
  const slowByTime = new Map(slowEma.map((p) => [p.time, p.value]));

  const macdLine: IndicatorPoint[] = [];
  for (const point of fastEma) {
    const slowValue = slowByTime.get(point.time);
    if (slowValue !== undefined) macdLine.push({ time: point.time, value: point.value - slowValue });
  }

  const signal = emaOfPoints(macdLine, signalPeriod);
  const signalByTime = new Map(signal.map((p) => [p.time, p.value]));
  const histogram = macdLine
    .filter((p) => signalByTime.has(p.time))
    .map((p) => ({ time: p.time, value: p.value - signalByTime.get(p.time)! }));

  return { macd: macdLine, signal, histogram };
}

function emaOfPoints(points: IndicatorPoint[], period: number): IndicatorPoint[] {
  const result: IndicatorPoint[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < points.length; i++) {
    if (prev === null) {
      if (i === period - 1) {
        prev = points.slice(0, period).reduce((sum, p) => sum + p.value, 0) / period;
        result.push({ time: points[i].time, value: prev });
      }
      continue;
    }
    prev = points[i].value * k + prev * (1 - k);
    result.push({ time: points[i].time, value: prev });
  }
  return result;
}

export interface StochasticResult {
  k: IndicatorPoint[];
  d: IndicatorPoint[];
}

/** Stochastic oscillator: %K (period, default 14) smoothed with a 3-period SMA for %D. */
export function stochastic(data: CandleDatum[], period = 14, smoothD = 3): StochasticResult {
  const kValues: IndicatorPoint[] = [];
  for (let i = period - 1; i < data.length; i++) {
    const window = data.slice(i - period + 1, i + 1);
    const highest = Math.max(...window.map((d) => d.high));
    const lowest = Math.min(...window.map((d) => d.low));
    const range = highest - lowest || 1;
    kValues.push({ time: data[i].time, value: ((data[i].close - lowest) / range) * 100 });
  }

  const d: IndicatorPoint[] = [];
  for (let i = smoothD - 1; i < kValues.length; i++) {
    const avg = kValues.slice(i - smoothD + 1, i + 1).reduce((sum, p) => sum + p.value, 0) / smoothD;
    d.push({ time: kValues[i].time, value: avg });
  }

  return { k: kValues, d };
}

/**
 * Volume-Weighted Average Price, cumulative across the whole loaded series (not session-based —
 * daily/intraday bars from our data sources don't carry a reliable session boundary marker).
 */
export function vwap(data: CandleDatum[]): IndicatorPoint[] {
  const points: IndicatorPoint[] = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;
  for (const bar of data) {
    const typicalPrice = (bar.high + bar.low + bar.close) / 3;
    cumulativePV += typicalPrice * bar.volume;
    cumulativeVolume += bar.volume;
    if (cumulativeVolume > 0) points.push({ time: bar.time, value: cumulativePV / cumulativeVolume });
  }
  return points;
}

export interface AdxResult {
  adx: IndicatorPoint[];
  plusDI: IndicatorPoint[];
  minusDI: IndicatorPoint[];
}

/**
 * Wilder's ADX (period, default 14), plus the +DI/-DI lines it's built from. ADX alone only
 * measures trend STRENGTH (0-100, higher = stronger trend, <20 roughly "no trend"), not
 * direction — callers that need a directional read (e.g. the technical score) compare +DI vs.
 * -DI: +DI > -DI means the strong trend (if any) is bullish, -DI > +DI means bearish.
 */
export function adx(data: CandleDatum[], period = 14): AdxResult {
  if (data.length <= period * 2) return { adx: [], plusDI: [], minusDI: [] };

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const cur = data[i];
    const prev = data[i - 1];
    trueRanges.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close)));

    const upMove = cur.high - prev.high;
    const downMove = prev.low - cur.low;
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Wilder smoothing: seed with the sum of the first `period` values, then recursively smooth.
  const wilderSmooth = (values: number[]): number[] => {
    if (values.length <= period) return [];
    const out: number[] = [];
    let smoothed = values.slice(0, period).reduce((sum, v) => sum + v, 0);
    out.push(smoothed);
    for (let i = period; i < values.length; i++) {
      smoothed = smoothed - smoothed / period + values[i];
      out.push(smoothed);
    }
    return out;
  };

  const smoothedTR = wilderSmooth(trueRanges);
  const smoothedPlusDM = wilderSmooth(plusDMs);
  const smoothedMinusDM = wilderSmooth(minusDMs);
  // trueRanges[k] (k=0..) corresponds to data[k+1] (built from the data[i-1]->data[i] step).
  // wilderSmooth's output index j corresponds to input index (period-1+j), i.e.
  // trueRanges[period-1+j], i.e. data[period+j].
  const timeForSmoothedIndex = (j: number) => data[period + j].time;

  const plusDI: IndicatorPoint[] = [];
  const minusDI: IndicatorPoint[] = [];
  const dx: number[] = [];
  for (let j = 0; j < smoothedTR.length; j++) {
    const tr = smoothedTR[j];
    const pDI = tr > 0 ? (smoothedPlusDM[j] / tr) * 100 : 0;
    const mDI = tr > 0 ? (smoothedMinusDM[j] / tr) * 100 : 0;
    plusDI.push({ time: timeForSmoothedIndex(j), value: pDI });
    minusDI.push({ time: timeForSmoothedIndex(j), value: mDI });
    const diSum = pDI + mDI;
    dx.push(diSum > 0 ? (Math.abs(pDI - mDI) / diSum) * 100 : 0);
  }

  const adxPoints: IndicatorPoint[] = [];
  if (dx.length > period) {
    let avg = dx.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    adxPoints.push({ time: timeForSmoothedIndex(period - 1), value: avg });
    for (let j = period; j < dx.length; j++) {
      avg = (avg * (period - 1) + dx[j]) / period;
      adxPoints.push({ time: timeForSmoothedIndex(j), value: avg });
    }
  }

  return { adx: adxPoints, plusDI, minusDI };
}

/** Wilder's Average True Range (period, default 14) — a volatility measure. */
export function atr(data: CandleDatum[], period = 14): IndicatorPoint[] {
  if (data.length <= period) return [];
  const trueRanges: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const cur = data[i];
    const prevClose = data[i - 1].close;
    trueRanges.push(Math.max(cur.high - cur.low, Math.abs(cur.high - prevClose), Math.abs(cur.low - prevClose)));
  }

  const points: IndicatorPoint[] = [];
  let avg = trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  points.push({ time: data[period].time, value: avg });
  for (let i = period; i < trueRanges.length; i++) {
    avg = (avg * (period - 1) + trueRanges[i]) / period;
    points.push({ time: data[i + 1].time, value: avg });
  }
  return points;
}
