"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  LineWidth,
  MouseEventParams,
  PriceScaleMode,
  SeriesType,
  TickMarkType,
  Time,
  UTCTimestamp,
} from "lightweight-charts";
import { cn } from "@/lib/cn";
import { formatCurrency, formatNumber } from "@/lib/format";
import { atr, bollingerBands, ema, IndicatorPoint, macd, rsi, sma, stochastic, vwap } from "@/lib/indicators";
import { fetchChartData } from "@/lib/chart-client";
import {
  CameraIcon,
  ChevronDownIcon,
  CloseIcon,
  CursorIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  GearIcon,
  HorizontalLineIcon,
  PlusIcon,
  RedoIcon,
  SearchIcon,
  SlidersIcon,
  TrashIcon,
  TrendLineIcon,
  UndoIcon,
} from "@/components/icons/Icons";
import { ChartSettingsDialog } from "./ChartSettingsDialog";
import { ChartSettings, defaultChartSettings, loadStoredChartSettings, saveChartSettings } from "./chartSettings";
import { DataSourceBadge } from "@/components/ui/Badge";
import { Drawing, loadDrawings, makeDrawingId, saveDrawings } from "./chartDrawings";
import { IndicatorLegendRow } from "./IndicatorLegendRow";
import { IndicatorStylePopover } from "./IndicatorStylePopover";

export interface CandleDatum {
  /** UNIX seconds, a "yyyy-mm-dd" business-day string, or any ISO datetime string. */
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const CHART_INTERVALS = ["5m", "1h", "1D", "1M"] as const;
export type ChartInterval = (typeof CHART_INTERVALS)[number];

// 1D/1W need intraday granularity (their own `interval`, distinct from the chart's active
// candle interval up top) — the others all read daily bars. `outputsize` is how many bars to
// request from the API when the currently-loaded data doesn't already cover the range (see
// selectRange below); `bars` is how many of those to actually show once loaded ("all" ranges
// just show everything fetched, since the fetch itself is already scoped to the window).
type RangeDef =
  | { id: string; interval: ChartInterval; outputsize: number; kind: "bars"; bars: number }
  | { id: string; interval: ChartInterval; outputsize: number; kind: "ytd" }
  | { id: string; interval: ChartInterval; outputsize: number; kind: "all" };

const VISIBLE_RANGES: RangeDef[] = [
  // outputsize is tuned for equity trading sessions (~6.5h/day, ~5 days/week) rather than 24/7
  // crypto — a size that fits both exactly doesn't exist here, and this app's live symbols are
  // mostly equities (SAP/NVDA/MSFT/TSLA/ASML vs. BTC/ETH/SOL), so that's the one favored.
  { id: "1D", interval: "5m", outputsize: 96, kind: "all" },
  { id: "1W", interval: "1h", outputsize: 50, kind: "all" },
  { id: "1M", interval: "1D", outputsize: 30, kind: "bars", bars: 21 },
  { id: "3M", interval: "1D", outputsize: 70, kind: "bars", bars: 63 },
  { id: "6M", interval: "1D", outputsize: 140, kind: "bars", bars: 126 },
  { id: "YTD", interval: "1D", outputsize: 260, kind: "ytd" },
  { id: "1Y", interval: "1D", outputsize: 260, kind: "bars", bars: 252 },
  { id: "5Y", interval: "1D", outputsize: 1300, kind: "bars", bars: 1260 },
  { id: "Max", interval: "1D", outputsize: 5000, kind: "bars", bars: 5000 },
];
type RangeId = (typeof VISIBLE_RANGES)[number]["id"];

export const CHART_TYPES = [
  { id: "candlestick", label: "Kerzen" },
  { id: "hollow", label: "Hohle Candlesticks" },
  { id: "bar", label: "Balken" },
  { id: "line", label: "Linie" },
  { id: "area", label: "Fläche" },
  { id: "baseline", label: "Baseline" },
] as const;
export type ChartType = (typeof CHART_TYPES)[number]["id"];
const CHART_TYPE_STORAGE_KEY = "finara-chart-type";

type PaneKey = "volume" | "rsi" | "macd" | "stochastic" | "atr";

type IndicatorId =
  | "sma20"
  | "sma50"
  | "ema20"
  | "bollinger"
  | "vwap"
  | "volume"
  | "rsi14"
  | "macd"
  | "stochastic"
  | "atr14";

// `legendName` is the base name shown in the per-indicator legend row (without the period, since
// that's appended dynamically from indicatorStyles/defaultPeriod — a user-adjusted period should
// update the legend text, unlike `label`, which stays static for the indicator-picker dropdown).
// `defaultPeriod` marks which indicators get a period input in IndicatorStylePopover — only the
// genuinely single-period ones (SMA/EMA/RSI/ATR), matching the request's explicit scope.
const INDICATOR_DEFS: { id: IndicatorId; label: string; legendName: string; pane: "price" | PaneKey; defaultPeriod?: number }[] = [
  { id: "sma20", label: "SMA 20", legendName: "SMA", pane: "price", defaultPeriod: 20 },
  { id: "sma50", label: "SMA 50", legendName: "SMA", pane: "price", defaultPeriod: 50 },
  { id: "ema20", label: "EMA 20", legendName: "EMA", pane: "price", defaultPeriod: 20 },
  { id: "bollinger", label: "Bollinger Bänder (20, 2)", legendName: "Bollinger Bänder", pane: "price" },
  { id: "vwap", label: "VWAP", legendName: "VWAP", pane: "price" },
  { id: "volume", label: "Volumen", legendName: "Volumen", pane: "volume" },
  { id: "rsi14", label: "RSI (14)", legendName: "RSI", pane: "rsi", defaultPeriod: 14 },
  { id: "macd", label: "MACD (12, 26, 9)", legendName: "MACD", pane: "macd" },
  { id: "stochastic", label: "Stochastic (14, 3)", legendName: "Stochastic", pane: "stochastic" },
  { id: "atr14", label: "ATR (14)", legendName: "ATR", pane: "atr", defaultPeriod: 14 },
];

/** Per-indicator style overrides — color(s), line width, and (only for single-period indicators)
 *  the period. `secondColor` is only meaningful for the two-line indicators (Bollinger/MACD/
 *  Stochastic). Persisted separately from `activeIndicators` since it's independent of which
 *  indicators are on. */
interface IndicatorStyle {
  color?: string;
  secondColor?: string;
  lineWidth?: number;
  period?: number;
}

/** One legend row's worth of colored values at a point in time — built alongside each indicator's
 *  actual plotted series data (see pushLegendValues below), so the legend can never show a value
 *  that doesn't correspond to a real drawn line. */
interface LegendValue {
  label?: string;
  value: string;
  color: string;
}

/** lightweight-charts' LineWidth is the literal union 1|2|3|4, not a plain number — clamps a
 *  stored/user-entered width (plain number, since IndicatorStyle persists to JSON) into it. */
function toLineWidth(n: number): LineWidth {
  const clamped = Math.round(Math.min(4, Math.max(1, n)));
  return clamped as LineWidth;
}

function pushLegendValues(
  target: Map<IndicatorId, Map<Time, LegendValue[]>>,
  id: IndicatorId,
  points: { time: string | number; value: number }[],
  formatValue: (raw: number) => string,
  color: string,
  label?: string,
) {
  let map = target.get(id);
  if (!map) {
    map = new Map();
    target.set(id, map);
  }
  points.forEach((p) => {
    const t = toChartTime(p.time);
    const entry = map!.get(t) ?? [];
    entry.push({ label, value: formatValue(p.value), color });
    map!.set(t, entry);
  });
}

const INDICATOR_COLORS: Record<string, string> = {
  sma20: "#2563eb",
  sma50: "#7c3aed",
  ema20: "#ea580c",
  vwap: "#0891b2",
  bollingerUpper: "#64748b",
  bollingerLower: "#64748b",
  rsi14: "#12b5a6",
  macdLine: "#2563eb",
  macdSignal: "#ea580c",
  stochK: "#2563eb",
  stochD: "#ea580c",
  atr14: "#7c3aed",
  compare: "#f59e0b",
};

const INDICATOR_STORAGE_KEY = "finara-chart-indicators";

interface ChartSnapshot {
  chartType: ChartType;
  activeIndicators: IndicatorId[];
  compareSymbol: string | null;
  settings: ChartSettings;
}

interface ThemeColors {
  background: string;
  text: string;
  grid: string;
  border: string;
  up: string;
  down: string;
}

/**
 * Reads chart colors from CSS custom properties so the chart follows the app's theme.
 * Prefers dedicated --chart-* tokens if a consumer defines them, otherwise falls back
 * to finara's existing --background/--foreground/--brand-border/--risk-low/--risk-high
 * tokens (app/globals.css) so it matches out of the box with zero extra setup.
 */
function readThemeColors(): ThemeColors {
  if (typeof window === "undefined") {
    return { background: "#ffffff", text: "#0b1b33", grid: "#e3e8f0", border: "#e3e8f0", up: "#16a34a", down: "#dc2626" };
  }
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  return {
    background: read("--chart-bg", read("--background", "#ffffff")),
    text: read("--chart-text", read("--foreground", "#0b1b33")),
    grid: read("--chart-grid", read("--brand-border", "#e3e8f0")),
    border: read("--chart-border", read("--brand-border", "#e3e8f0")),
    up: read("--chart-up", read("--risk-low", "#16a34a")),
    down: read("--chart-down", read("--risk-high", "#dc2626")),
  };
}

function toChartTime(t: string | number): Time {
  if (typeof t === "number") return t as UTCTimestamp;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t as Time;
  return Math.floor(new Date(t).getTime() / 1000) as UTCTimestamp;
}

function timeToDate(time: Time): Date {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
  const bd = time as unknown as { year: number; month: number; day: number };
  return new Date(Date.UTC(bd.year, bd.month - 1, bd.day));
}

function formatInZone(time: Time, timeZone: string, withTime: boolean): string {
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: withTime ? undefined : "numeric",
      hour: withTime ? "2-digit" : undefined,
      minute: withTime ? "2-digit" : undefined,
    }).format(timeToDate(time));
  } catch {
    return "";
  }
}

// Time-axis tick labels. lightweight-charts already classifies each tick by how far apart
// consecutive ticks are (year/month/day/time) and passes that in — this switches format
// accordingly instead of always showing a date, so intraday intervals (5m/1h, whose candle
// times carry a real time-of-day, unlike 1D/1M's date-only business-day values) show "Aug 18"
// at day boundaries and just "13:20" for the ticks within that day, matching the reference.
function formatTickMark(time: Time, tickMarkType: TickMarkType, timeZone: string): string {
  const date = timeToDate(time);
  try {
    switch (tickMarkType) {
      case TickMarkType.Year:
        return new Intl.DateTimeFormat("de-DE", { timeZone, year: "numeric" }).format(date);
      case TickMarkType.Month:
        return new Intl.DateTimeFormat("de-DE", { timeZone, month: "short", year: "numeric" }).format(date);
      case TickMarkType.DayOfMonth:
        return new Intl.DateTimeFormat("de-DE", { timeZone, day: "2-digit", month: "short" }).format(date);
      case TickMarkType.TimeWithSeconds:
        return new Intl.DateTimeFormat("de-DE", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(date);
      case TickMarkType.Time:
      default:
        return new Intl.DateTimeFormat("de-DE", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
    }
  } catch {
    return "";
  }
}

// Legend date/time: date-only for daily/monthly bars (no time-of-day in the underlying data),
// date + time for intraday bars (5m/1h candle times carry a real UTCTimestamp).
function formatLegendTime(raw: string | number, timeZone: string): string {
  const time = toChartTime(raw);
  return formatInZone(time, timeZone, typeof time !== "string");
}

function toLineData(points: IndicatorPoint[]) {
  return points.map((p) => ({ time: toChartTime(p.time), value: p.value }));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16) || 0;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadFavoriteIndicators(): IndicatorId[] {
  if (typeof window === "undefined") return ["volume"];
  try {
    const stored = window.localStorage.getItem(INDICATOR_STORAGE_KEY);
    if (!stored) return ["volume"];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is IndicatorId => INDICATOR_DEFS.some((d) => d.id === id)) : ["volume"];
  } catch {
    return ["volume"];
  }
}

const HIDDEN_INDICATORS_STORAGE_KEY = "finara-chart-hidden-indicators";
const INDICATOR_STYLES_STORAGE_KEY = "finara-chart-indicator-styles";

function loadHiddenIndicators(): IndicatorId[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(HIDDEN_INDICATORS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((id): id is IndicatorId => INDICATOR_DEFS.some((d) => d.id === id)) : [];
  } catch {
    return [];
  }
}

function loadIndicatorStyles(): Partial<Record<IndicatorId, IndicatorStyle>> {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.localStorage.getItem(INDICATOR_STYLES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function loadChartType(): ChartType {
  if (typeof window === "undefined") return "candlestick";
  try {
    const stored = window.localStorage.getItem(CHART_TYPE_STORAGE_KEY);
    return CHART_TYPES.some((t) => t.id === stored) ? (stored as ChartType) : "candlestick";
  } catch {
    return "candlestick";
  }
}

/** lightweight-charts v4 can't switch a live series' kind — the only way to change chart type
 *  is to remove the series and add a new one of the desired kind with the same data. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMainSeries(chart: IChartApi, type: ChartType, settings: ChartSettings): ISeriesApi<any> {
  const common = {
    priceScaleId: "right",
    priceLineVisible: settings.priceLineVisible,
    priceLineColor: settings.priceLineColor,
  };
  switch (type) {
    case "hollow":
      return chart.addCandlestickSeries({
        upColor: "rgba(0, 0, 0, 0)",
        downColor: settings.downColor,
        borderUpColor: settings.upColor,
        borderDownColor: settings.downColor,
        wickUpColor: settings.upColor,
        wickDownColor: settings.downColor,
        ...common,
      });
    case "bar":
      return chart.addBarSeries({ upColor: settings.upColor, downColor: settings.downColor, ...common });
    case "line":
      return chart.addLineSeries({ color: settings.upColor, lineWidth: 2, ...common });
    case "area":
      return chart.addAreaSeries({
        lineColor: settings.upColor,
        topColor: hexToRgba(settings.upColor, 0.28),
        bottomColor: hexToRgba(settings.upColor, 0.02),
        ...common,
      });
    case "baseline":
      return chart.addBaselineSeries({
        topLineColor: settings.upColor,
        bottomLineColor: settings.downColor,
        topFillColor1: hexToRgba(settings.upColor, 0.26),
        topFillColor2: hexToRgba(settings.upColor, 0.02),
        bottomFillColor1: hexToRgba(settings.downColor, 0.02),
        bottomFillColor2: hexToRgba(settings.downColor, 0.26),
        ...common,
      });
    case "candlestick":
    default:
      return chart.addCandlestickSeries({
        upColor: settings.upColor,
        downColor: settings.downColor,
        borderUpColor: settings.upColor,
        borderDownColor: settings.downColor,
        wickUpColor: settings.upColor,
        wickDownColor: settings.downColor,
        ...common,
      });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setMainSeriesData(series: ISeriesApi<any>, type: ChartType, data: CandleDatum[]) {
  if (type === "candlestick" || type === "hollow" || type === "bar") {
    series.setData(data.map((d) => ({ time: toChartTime(d.time), open: d.open, high: d.high, low: d.low, close: d.close })));
  } else if (type === "baseline") {
    const avg = data.reduce((sum, d) => sum + d.close, 0) / (data.length || 1);
    series.applyOptions({ baseValue: { type: "price", price: avg } });
    series.setData(data.map((d) => ({ time: toChartTime(d.time), value: d.close })));
  } else {
    series.setData(data.map((d) => ({ time: toChartTime(d.time), value: d.close })));
  }
}

// Sizes the drawing-overlay canvas to match the chart container 1:1 while staying crisp on
// high-DPI screens: CSS size follows the container, backing-store size is scaled by devicePixelRatio.
function resizeOverlayCanvas(canvas: HTMLCanvasElement | null, cssWidth: number, cssHeight: number) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

interface CandlestickChartProps {
  symbol: string;
  name?: string;
  data: CandleDatum[];
  currency?: "EUR" | "USD";
  /** Whether `data` came from a real Twelve Data/Finnhub fetch or the deterministic mock
   *  generator — rendered as a DataSourceBadge next to the symbol name so this is visible on the
   *  one chart component actually used everywhere (ChartWorkspace), not just the standalone
   *  instrument detail page. Omit when unknown (e.g. no instrument resolved yet). */
  dataSource?: "live" | "simulated";
  /** Controlled active interval; omit to let the component manage its own selection. */
  interval?: ChartInterval;
  /** `outputsize` is set when a range button needs more/different bars than are currently
   *  loaded for the requested interval (e.g. switching to 5m for "1D", or needing 1300 daily
   *  bars for "5Y") — the parent should refetch with that outputsize. Omitted for a plain
   *  top-toolbar interval click, where the parent's own default is fine. */
  onIntervalChange?: (interval: ChartInterval, outputsize?: number) => void;
  /** Intervals to render as disabled (e.g. granularities your data source can't provide). */
  disabledIntervals?: ChartInterval[];
  /** Controlled chart type — used by ChartWorkspace to keep multiple panes' type in sync. Omit to let the component manage its own (persisted) selection. */
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
  /** Fires once the underlying lightweight-charts instance exists — lets a parent (e.g. ChartWorkspace) hook into it for cross-pane crosshair/range sync. */
  onChartReady?: (chart: IChartApi, mainSeries: ISeriesApi<SeriesType>) => void;
  /** Set while a data fetch for the active interval is in flight. */
  loading?: boolean;
  /** Set when loading `data` for the active interval failed (e.g. a rate limit) — shown instead of a blank/crashed chart. */
  loadError?: string | null;
  /** Minimum pixel height as a document-flow fallback. The chart otherwise fills its parent's
   *  available height via flex — pass a parent with a definite height (h-full/flex-1) for that
   *  to actually grow beyond this floor. */
  height?: number;
  className?: string;
  /** Extra content rendered in the toolbar's right-hand button group, directly before the
   *  Fullscreen button — used by ChartWorkspace to host its workspace-level Layout control
   *  (which has no natural home of its own, since it applies to the whole multi-pane grid,
   *  not any single pane) without a separate toolbar row. */
  toolbarExtra?: ReactNode;
}

export function CandlestickChart({
  symbol,
  name,
  data,
  currency = "EUR",
  interval: controlledInterval,
  onIntervalChange,
  disabledIntervals = [],
  dataSource,
  chartType: controlledChartType,
  onChartTypeChange,
  onChartReady,
  loading = false,
  loadError = null,
  height = 520,
  className,
  toolbarExtra,
}: CandlestickChartProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const compareSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const dataRef = useRef<CandleDatum[]>([]);
  const dataByTimeRef = useRef<Map<Time, CandleDatum>>(new Map());

  const [uncontrolledInterval, setUncontrolledInterval] = useState<ChartInterval>("1D");
  const activeInterval = controlledInterval ?? uncontrolledInterval;
  const [hovered, setHovered] = useState<CandleDatum | null>(null);
  // Visible bar range (logical indices), kept in sync with the chart's actual pan/zoom state —
  // drives the legend's change%/date-range display so it reflects what's on screen instead of
  // always being a fixed day-over-day comparison. Updated both by range-button clicks
  // (setVisibleLogicalRange/fitContent fire the same subscription) and by manual zoom/drag.
  const [visibleRange, setVisibleRange] = useState<{ from: number; to: number } | null>(null);

  const [activeIndicators, setActiveIndicators] = useState<IndicatorId[]>([]);
  const [indicatorsLoaded, setIndicatorsLoaded] = useState(false);
  const [indicatorMenuOpen, setIndicatorMenuOpen] = useState(false);
  const [indicatorSearch, setIndicatorSearch] = useState("");
  // Visibility is tracked separately from "active" (added) — hiding an indicator via its legend
  // row's eye icon keeps its series/legend row/pane separator in place, just invisible.
  const [hiddenIndicators, setHiddenIndicators] = useState<IndicatorId[]>([]);
  const [indicatorStyles, setIndicatorStyles] = useState<Partial<Record<IndicatorId, IndicatorStyle>>>({});
  const [styleEditorFor, setStyleEditorFor] = useState<IndicatorId | null>(null);
  // State, not a ref: this is read directly during render (legendValuesFor below), and refs must
  // never be accessed during render — only inside effects/handlers, per the react-hooks/refs rule.
  const [indicatorLegendData, setIndicatorLegendData] = useState<Map<IndicatorId, Map<Time, LegendValue[]>>>(new Map());

  const [activeRange, setActiveRange] = useState<RangeId>("Max");

  const [uncontrolledChartType, setUncontrolledChartType] = useState<ChartType>("candlestick");
  const chartType = controlledChartType ?? uncontrolledChartType;
  const [chartTypeLoaded, setChartTypeLoaded] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);

  const [fullscreen, setFullscreen] = useState(false);
  const [undoStack, setUndoStack] = useState<ChartSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ChartSnapshot[]>([]);
  const isTimeTravelingRef = useRef(false);

  const [settings, setSettings] = useState<ChartSettings>(() => defaultChartSettings(readThemeColors()));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [compareOpen, setCompareOpen] = useState(false);
  const [compareQuery, setCompareQuery] = useState("");
  const [compareSymbol, setCompareSymbol] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<CandleDatum[]>([]);
  const [compareChangePct, setCompareChangePct] = useState<number | null>(null);
  const [compareLoadedFor, setCompareLoadedFor] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Drawing tools (horizontal line + trend line). Kept out of the undo/redo snapshot system —
  // folding them into ChartSnapshot would couple drawings to 7 unrelated actions (indicator
  // toggles, settings changes, …), so an unrelated undo could silently delete a drawing.
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingsLoaded, setDrawingsLoaded] = useState(false);
  const [activeTool, setActiveTool] = useState<"cursor" | "horizontal-line" | "trend-line">("cursor");
  const [pendingPointA, setPendingPointA] = useState<{ time: Time; price: number } | null>(null);
  const [cursorPoint, setCursorPoint] = useState<{ time: Time; price: number } | null>(null);
  const [mainSeriesVersion, setMainSeriesVersion] = useState(0);
  const priceLineHandlesRef = useRef<Map<string, IPriceLine>>(new Map());
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawOverlayRef = useRef<(() => void) | null>(null);

  // Drawings persist per symbol (unlike indicators/chart-type, which are global preferences) —
  // reload whenever the symbol changes, not just once on mount.
  useEffect(() => {
    Promise.resolve().then(() => {
      setDrawings(loadDrawings(symbol));
      setDrawingsLoaded(true);
    });
  }, [symbol]);

  function addDrawing(drawing: Drawing) {
    setDrawings((prev) => {
      const next = [...prev, drawing];
      saveDrawings(symbol, next);
      return next;
    });
  }

  function clearAllDrawings() {
    setDrawings([]);
    saveDrawings(symbol, []);
  }

  function resetDrawingTool() {
    setActiveTool("cursor");
    setPendingPointA(null);
    setCursorPoint(null);
  }

  // Load persisted prefs (favorite indicators, chart type, chart settings) once on mount.
  useEffect(() => {
    Promise.resolve().then(() => {
      setActiveIndicators(loadFavoriteIndicators());
      setIndicatorsLoaded(true);
      setHiddenIndicators(loadHiddenIndicators());
      setIndicatorStyles(loadIndicatorStyles());
      setUncontrolledChartType(loadChartType());
      setChartTypeLoaded(true);
      const stored = loadStoredChartSettings();
      if (stored) setSettings((prev) => ({ ...prev, ...stored }));
      setSettingsLoaded(true);
    });
  }, []);

  function pushUndoSnapshot() {
    if (isTimeTravelingRef.current) return;
    setUndoStack((prev) => [...prev, { chartType, activeIndicators, compareSymbol, settings }]);
    setRedoStack([]);
  }

  function applySnapshot(snap: ChartSnapshot) {
    isTimeTravelingRef.current = true;
    setUncontrolledChartType(snap.chartType);
    onChartTypeChange?.(snap.chartType);
    setActiveIndicators(snap.activeIndicators);
    window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(snap.activeIndicators));
    setSettings(snap.settings);
    saveChartSettings(snap.settings);
    if (snap.compareSymbol !== compareSymbol) {
      setCompareSymbol(snap.compareSymbol);
      setCompareLoadedFor(null);
      setCompareError(null);
    }
    Promise.resolve().then(() => {
      isTimeTravelingRef.current = false;
    });
  }

  function undo() {
    if (undoStack.length === 0) return;
    const snap = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { chartType, activeIndicators, compareSymbol, settings }]);
    setUndoStack((prev) => prev.slice(0, -1));
    applySnapshot(snap);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const snap = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { chartType, activeIndicators, compareSymbol, settings }]);
    setRedoStack((prev) => prev.slice(0, -1));
    applySnapshot(snap);
  }

  function toggleIndicator(id: IndicatorId) {
    pushUndoSnapshot();
    setActiveIndicators((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeIndicator(id: IndicatorId) {
    pushUndoSnapshot();
    setActiveIndicators((prev) => {
      const next = prev.filter((x) => x !== id);
      window.localStorage.setItem(INDICATOR_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleIndicatorVisibility(id: IndicatorId) {
    setHiddenIndicators((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      window.localStorage.setItem(HIDDEN_INDICATORS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateIndicatorStyle(id: IndicatorId, patch: Partial<IndicatorStyle>) {
    setIndicatorStyles((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...patch } };
      window.localStorage.setItem(INDICATOR_STYLES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function selectChartType(type: ChartType) {
    pushUndoSnapshot();
    setUncontrolledChartType(type);
    onChartTypeChange?.(type);
    window.localStorage.setItem(CHART_TYPE_STORAGE_KEY, type);
    setTypeMenuOpen(false);
  }

  function updateSettings(patch: Partial<ChartSettings>) {
    pushUndoSnapshot();
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveChartSettings(next);
      return next;
    });
  }

  function resetSettings() {
    pushUndoSnapshot();
    const next = defaultChartSettings(readThemeColors());
    setSettings(next);
    saveChartSettings(next);
  }

  function toggleFullscreen() {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  }

  function takeScreenshot() {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol}-${activeInterval}-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  function applyIntervalChange(next: ChartInterval, outputsize?: number) {
    setUncontrolledInterval(next);
    onIntervalChange?.(next, outputsize);
  }

  function selectInterval(next: ChartInterval) {
    if (disabledIntervals.includes(next)) return;
    applyIntervalChange(next);
    // Keep the range highlight from contradicting the newly-picked interval (e.g. "1D" range +
    // "1M" interval makes no sense together) — pick a representative range for whatever
    // granularity was just chosen, unless the current one is already consistent with it.
    setActiveRange((prev) => {
      const prevDef = VISIBLE_RANGES.find((r) => r.id === prev);
      if (prevDef?.interval === next) return prev;
      if (next === "5m") return "1D";
      if (next === "1h") return "1W";
      if (next === "1M") return "Max"; // monthly candles only make sense zoomed way out
      return "6M"; // next === "1D"; previous range was 1D/1W (intraday-only)
    });
  }

  // Applies a range preset to whatever `data` is currently loaded, and — if that isn't enough
  // to actually cover the range — kicks off a background fetch for more via applyIntervalChange.
  // No separate "pending range" bookkeeping is needed: the effect below (which depends on
  // `data`) already calls selectRange(activeRange) again on every data change, so once the
  // bigger/different-interval fetch lands, this simply re-runs and finds enough data that time.
  function selectRange(range: RangeId) {
    setActiveRange(range);
    const chart = chartRef.current;
    const def = VISIBLE_RANGES.find((r) => r.id === range);
    if (!def || !chart) return;

    if (activeInterval !== def.interval) {
      applyIntervalChange(def.interval, def.outputsize);
      return;
    }

    if (def.kind === "ytd") {
      const jan1 = `${new Date().getFullYear()}-01-01`;
      const haveFullYear = data.length > 0 && String(data[0].time) <= jan1;
      if (!haveFullYear) applyIntervalChange(def.interval, def.outputsize);
      const fromIdx = data.findIndex((d) => String(d.time) >= jan1);
      if (fromIdx <= 0) chart.timeScale().fitContent();
      else chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: data.length - 1 });
      return;
    }

    const need = def.kind === "bars" ? def.bars : def.outputsize;
    if (data.length < Math.min(need, def.outputsize)) applyIntervalChange(def.interval, def.outputsize);
    if (need >= data.length) chart.timeScale().fitContent();
    else chart.timeScale().setVisibleLogicalRange({ from: data.length - need, to: data.length - 1 });
  }

  function submitCompare(e: FormEvent) {
    e.preventDefault();
    const sym = compareQuery.trim().toUpperCase();
    if (!sym) return;
    pushUndoSnapshot();
    setCompareSymbol(sym);
    setCompareLoadedFor(null);
    setCompareError(null);
    setCompareOpen(false);
  }

  function removeCompare() {
    pushUndoSnapshot();
    setCompareSymbol(null);
    setCompareData([]);
    setCompareChangePct(null);
    setCompareLoadedFor(null);
    setCompareError(null);
    setCompareQuery("");
  }

  // Fullscreen: track state (so the icon/toolbar reflect it) and support exiting via Escape,
  // which the browser triggers itself but doesn't otherwise tell React about.
  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // ESC cancels an in-progress drawing (or just deselects an armed tool) without committing it.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") resetDrawingTool();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Chart instance setup — created once per mount. Height comes from the container's own
  // rendered size (it fills its flex parent via CSS) rather than a fixed option, so the chart
  // genuinely fills whatever space its parent gives it instead of stopping at a hardcoded pixel
  // value and leaving dead space below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const colors = readThemeColors();

    const chart = createChart(container, {
      layout: { background: { color: colors.background }, textColor: colors.text, attributionLogo: false },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      width: container.clientWidth,
      height: container.clientHeight || height,
    });

    // OHLC/volume legend is read straight from the `data` prop by time lookup rather than from
    // the crosshair's own seriesData — that keeps it correct across every chart type (Line/Area
    // series only carry a "value", not full OHLC).
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHovered(null);
        return;
      }
      setHovered(dataByTimeRef.current.get(param.time) ?? null);
    });

    const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "volume" });

    chartRef.current = chart;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height: h } = entry.contentRect;
      if (width && h) {
        chart.applyOptions({ width, height: h });
        resizeOverlayCanvas(overlayCanvasRef.current, width, h);
        drawOverlayRef.current?.();
      }
    });
    resizeObserver.observe(container);

    function applyTheme() {
      const next = readThemeColors();
      chart.applyOptions({
        layout: { background: { color: next.background }, textColor: next.text },
        rightPriceScale: { borderColor: next.border },
        timeScale: { borderColor: next.border },
      });
      setSettings((prev) => {
        if (prev.gridColorCustomized) return prev; // user picked a custom grid color — leave it
        const updated = { ...prev, gridColor: next.grid };
        saveChartSettings(updated);
        return updated;
      });
    }

    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);

    // Legend change%/date-range tracking — fires on both programmatic range changes (range
    // buttons' setVisibleLogicalRange/fitContent) and manual zoom/drag. rAF-throttled since drag
    // fires this on nearly every frame and each update triggers a React re-render.
    let visibleRangeRaf: number | null = null;
    function onVisibleRangeChange() {
      if (visibleRangeRaf !== null) return;
      visibleRangeRaf = requestAnimationFrame(() => {
        visibleRangeRaf = null;
        const range = chart.timeScale().getVisibleLogicalRange();
        setVisibleRange(range ? { from: range.from, to: range.to } : null);
      });
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      media.removeEventListener("change", applyTheme);
      if (visibleRangeRaf !== null) cancelAnimationFrame(visibleRangeRaf);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      compareSeriesRef.current = null;
      indicatorSeriesRef.current = [];
    };
    // Mount-once: `height` above is only an initial fallback before the container has a real
    // rendered size, not something that should tear down and recreate the whole chart instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main series create/recreate — chart type or its colors changed. v4 has no "change series
  // kind in place" API, so this is remove-and-readd, per the requirements.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartTypeLoaded || !settingsLoaded) return;
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
    }
    const series = createMainSeries(chart, chartType, settings);
    setMainSeriesData(series, chartType, dataRef.current);
    mainSeriesRef.current = series;
    onChartReady?.(chart, series);
    // Price lines are attached to the series instance itself (v4 has no series-transfer API),
    // so they die when the old series is removed above — bump this to force the price-line
    // sync effect to recreate them against the freshly-created series.
    setMainSeriesVersion((v) => v + 1);
    // Deliberately narrow deps: only recreate the series for changes that actually affect its
    // creation options — other settings (grid, watermark, timezone, …) are applied separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType, chartTypeLoaded, settingsLoaded, settings.upColor, settings.downColor, settings.priceLineVisible, settings.priceLineColor]);

  // Settings that apply to the chart/series without needing a series rebuild.
  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries || !settingsLoaded) return;

    chart.applyOptions({
      grid: {
        vertLines: { color: settings.gridVisible ? settings.gridColor : "transparent" },
        horzLines: { color: settings.gridVisible ? settings.gridColor : "transparent" },
      },
      watermark: {
        visible: settings.watermarkVisible,
        text: symbol,
        color: "rgba(128, 128, 128, 0.16)",
        fontSize: 48,
        horzAlign: "center",
        vertAlign: "center",
      },
      localization: { timeFormatter: (t: Time) => formatInZone(t, settings.timezone, true) },
      timeScale: { tickMarkFormatter: (t: Time, type: TickMarkType) => formatTickMark(t, type, settings.timezone) },
    });

    let mode = PriceScaleMode.Normal;
    if (settings.percentScale) mode = PriceScaleMode.Percentage;
    else if (settings.logScale) mode = PriceScaleMode.Logarithmic;
    mainSeries.priceScale().applyOptions({ mode, autoScale: settings.autoScale });
  }, [settings, settingsLoaded, symbol]);

  // Drawing-tool click handling. Additive to the chart's own click/pan behavior — when
  // activeTool is "cursor" this handler no-ops, so normal drag-to-pan and zoom are untouched.
  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries) return;

    function handleClick(param: MouseEventParams<Time>) {
      const series = mainSeriesRef.current;
      if (!series) return;
      if (activeTool === "horizontal-line") {
        if (!param.point) return; // click landed outside the pane (e.g. on an axis)
        const clickedPrice = series.coordinateToPrice(param.point.y);
        if (clickedPrice === null) return;
        addDrawing({ id: makeDrawingId(), type: "horizontal-line", price: clickedPrice, color: settings.upColor });
        setActiveTool("cursor");
      } else if (activeTool === "trend-line") {
        if (!param.point || !param.time) return;
        const clickedPrice = series.coordinateToPrice(param.point.y);
        if (clickedPrice === null) return;
        if (!pendingPointA) {
          setPendingPointA({ time: param.time, price: clickedPrice });
        } else {
          addDrawing({
            id: makeDrawingId(),
            type: "trend-line",
            pointA: { time: pendingPointA.time as number, price: pendingPointA.price },
            pointB: { time: param.time as number, price: clickedPrice },
            color: settings.upColor,
          });
          resetDrawingTool();
        }
      }
    }

    chart.subscribeClick(handleClick);
    return () => chart.unsubscribeClick(handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, pendingPointA, settings.upColor]);

  // Renders horizontal-line drawings as native price lines. Kept separate from the click
  // handler above so the same recreation logic also fires after a chart-type switch, since v4
  // has no series-transfer API — the old series (and any price lines on it) is destroyed and a
  // new one created, so mainSeriesVersion (bumped there) forces a rebuild against the new series.
  useEffect(() => {
    const mainSeries = mainSeriesRef.current;
    if (!mainSeries || !drawingsLoaded) return;
    priceLineHandlesRef.current.forEach((line) => {
      try {
        mainSeries.removePriceLine(line);
      } catch {
        // series already gone (e.g. torn down mid-unmount) — nothing to clean up
      }
    });
    priceLineHandlesRef.current.clear();
    for (const d of drawings) {
      if (d.type !== "horizontal-line") continue;
      const line = mainSeries.createPriceLine({
        price: d.price,
        color: d.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "",
      });
      priceLineHandlesRef.current.set(d.id, line);
    }
  }, [drawings, drawingsLoaded, mainSeriesVersion]);

  // Trend-line overlay canvas: redraws on drawings changes, crosshair move (for the rubber-band
  // preview while placing point B), pan/zoom, and resize (wired into the ResizeObserver above).
  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    if (!chart || !mainSeries) return;

    function draw() {
      const canvas = overlayCanvasRef.current;
      const ctx = canvas?.getContext("2d");
      const series = mainSeriesRef.current;
      if (!canvas || !ctx || !series || !chart) return;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      for (const d of drawings) {
        if (d.type !== "trend-line") continue;
        const x1 = chart.timeScale().timeToCoordinate(d.pointA.time as UTCTimestamp);
        const y1 = series.priceToCoordinate(d.pointA.price);
        const x2 = chart.timeScale().timeToCoordinate(d.pointB.time as UTCTimestamp);
        const y2 = series.priceToCoordinate(d.pointB.price);
        if (x1 === null || y1 === null || x2 === null || y2 === null) continue; // off-screen/out of range
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (activeTool === "trend-line" && pendingPointA && cursorPoint) {
        const x1 = chart.timeScale().timeToCoordinate(pendingPointA.time as UTCTimestamp);
        const y1 = series.priceToCoordinate(pendingPointA.price);
        const x2 = chart.timeScale().timeToCoordinate(cursorPoint.time as UTCTimestamp);
        const y2 = series.priceToCoordinate(cursorPoint.price);
        if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = settings.upColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    drawOverlayRef.current = draw;
    draw();

    function onCrosshairMove(param: MouseEventParams<Time>) {
      const series = mainSeriesRef.current;
      if (activeTool === "trend-line" && pendingPointA && param.point && param.time && series) {
        const hoveredPrice = series.coordinateToPrice(param.point.y);
        if (hoveredPrice !== null) setCursorPoint({ time: param.time, price: hoveredPrice });
      }
      draw();
    }
    chart.subscribeCrosshairMove(onCrosshairMove);
    const rangeHandler = () => draw();
    chart.timeScale().subscribeVisibleLogicalRangeChange(rangeHandler);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(rangeHandler);
    };
  }, [drawings, activeTool, pendingPointA, cursorPoint, settings.upColor, mainSeriesVersion]);

  // Pane layout: price on top; volume (if visible) + any active oscillator panes stacked below
  // it. lightweight-charts v4 has no native multi-pane API — giving each pane's series its own
  // priceScaleId + scaleMargins is the standard v4 way to fake stacked panes. Extracted as a
  // memo (rather than computed inline in the data effect below) so the pane-separator-line/
  // legend-row overlay in the render below can read the exact same boundary fractions that
  // actually get applied to the series' scaleMargins — the two can never drift apart.
  const paneLayout = useMemo(() => {
    const showVolume = activeIndicators.includes("volume");
    const panes = new Map<PaneKey, boolean>();
    if (activeIndicators.includes("rsi14")) panes.set("rsi", true);
    if (activeIndicators.includes("macd")) panes.set("macd", true);
    if (activeIndicators.includes("stochastic")) panes.set("stochastic", true);
    if (activeIndicators.includes("atr14")) panes.set("atr", true);

    const bottomKeys: PaneKey[] = [];
    if (showVolume) bottomKeys.push("volume");
    (["rsi", "macd", "stochastic", "atr"] as PaneKey[]).forEach((k) => panes.has(k) && bottomKeys.push(k));

    if (bottomKeys.length === 0) {
      return { price: { top: 0.08, bottom: 0.05 }, panes: {} as Partial<Record<PaneKey, { top: number; bottom: number }>> };
    }

    // Volume gets a fixed, compact band (not an equal share of the oscillator region — that used
    // to let a volume-only chart claim ~41% of the height) so it always reads as a thin strip
    // regardless of which/how many oscillator panes are also active.
    const VOLUME_BAND = 0.13;
    const GAP = 0.02;
    const oscillatorKeys = bottomKeys.filter((k) => k !== "volume");
    const hasOscillators = oscillatorKeys.length > 0;
    const volumeBand = showVolume ? VOLUME_BAND : 0;
    const oscillatorRegionTop = 0.58;
    const oscillatorRegionBottom = hasOscillators ? 1 - volumeBand - (showVolume ? GAP : 0.01) : 1 - volumeBand;
    const priceBottomMargin = hasOscillators ? 1 - oscillatorRegionTop + GAP : volumeBand + GAP;

    const paneMargins: Partial<Record<PaneKey, { top: number; bottom: number }>> = {};
    if (hasOscillators) {
      const each = (oscillatorRegionBottom - oscillatorRegionTop) / oscillatorKeys.length;
      oscillatorKeys.forEach((key, i) => {
        const top = oscillatorRegionTop + i * each;
        const bottom = Math.max(1 - (top + each), 0);
        paneMargins[key] = { top, bottom };
      });
    }
    if (showVolume) paneMargins.volume = { top: 1 - volumeBand, bottom: 0 };

    return { price: { top: 0.06, bottom: priceBottomMargin }, panes: paneMargins };
  }, [activeIndicators]);

  // Data + indicator sync — (re)plots the main series, volume, and every active indicator pane.
  useEffect(() => {
    const chart = chartRef.current;
    const mainSeries = mainSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !mainSeries || !volumeSeries || !indicatorsLoaded || !chartTypeLoaded) return;
    const colors = readThemeColors();

    dataRef.current = data;
    dataByTimeRef.current = new Map(data.map((d) => [toChartTime(d.time), d]));

    setMainSeriesData(mainSeries, chartType, data);

    const showVolume = activeIndicators.includes("volume");
    volumeSeries.applyOptions({ visible: showVolume && !hiddenIndicators.includes("volume"), color: settings.upColor });
    volumeSeries.setData(
      data.map((d) => ({
        time: toChartTime(d.time),
        value: d.volume,
        color: d.close >= d.open ? settings.upColor : settings.downColor,
      })),
    );

    indicatorSeriesRef.current.forEach((series) => chart.removeSeries(series));
    indicatorSeriesRef.current = [];
    const legendData = new Map<IndicatorId, Map<Time, LegendValue[]>>();
    const priceFmt = (v: number) => formatCurrency(v, currency);
    const oscillatorFmt = (v: number) => v.toFixed(2);
    const isHidden = (id: IndicatorId) => hiddenIndicators.includes(id);

    for (const id of activeIndicators) {
      const style = indicatorStyles[id];
      const visible = !isHidden(id);
      if (id === "sma20" || id === "sma50") {
        const period = style?.period ?? INDICATOR_DEFS.find((d) => d.id === id)!.defaultPeriod!;
        const color = style?.color ?? INDICATOR_COLORS[id];
        const s = chart.addLineSeries({ color, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "right", visible });
        const points = sma(data, period);
        s.setData(toLineData(points));
        pushLegendValues(legendData, id, points, priceFmt, color);
        indicatorSeriesRef.current.push(s);
      } else if (id === "ema20") {
        const period = style?.period ?? INDICATOR_DEFS.find((d) => d.id === id)!.defaultPeriod!;
        const color = style?.color ?? INDICATOR_COLORS.ema20;
        const s = chart.addLineSeries({ color, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "right", visible });
        const points = ema(data, period);
        s.setData(toLineData(points));
        pushLegendValues(legendData, id, points, priceFmt, color);
        indicatorSeriesRef.current.push(s);
      } else if (id === "vwap") {
        const color = style?.color ?? INDICATOR_COLORS.vwap;
        const s = chart.addLineSeries({ color, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "right", visible });
        const points = vwap(data);
        s.setData(toLineData(points));
        pushLegendValues(legendData, id, points, priceFmt, color);
        indicatorSeriesRef.current.push(s);
      } else if (id === "bollinger") {
        const upperColor = style?.color ?? INDICATOR_COLORS.bollingerUpper;
        const lowerColor = style?.secondColor ?? INDICATOR_COLORS.bollingerLower;
        const bands = bollingerBands(data, 20, 2);
        const upper = chart.addLineSeries({ color: upperColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), lineStyle: LineStyle.Dashed, priceScaleId: "right", visible });
        upper.setData(toLineData(bands.upper));
        const lower = chart.addLineSeries({ color: lowerColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), lineStyle: LineStyle.Dashed, priceScaleId: "right", visible });
        lower.setData(toLineData(bands.lower));
        pushLegendValues(legendData, id, bands.upper, priceFmt, upperColor, "Oberes Band");
        pushLegendValues(legendData, id, bands.lower, priceFmt, lowerColor, "Unteres Band");
        indicatorSeriesRef.current.push(upper, lower);
      } else if (id === "rsi14") {
        const period = style?.period ?? INDICATOR_DEFS.find((d) => d.id === id)!.defaultPeriod!;
        const color = style?.color ?? INDICATOR_COLORS.rsi14;
        const s = chart.addLineSeries({ color, lineWidth: toLineWidth(style?.lineWidth ?? 2), priceScaleId: "rsi", visible });
        const points = rsi(data, period);
        s.setData(toLineData(points));
        s.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
        s.createPriceLine({ price: 70, color: colors.down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "70" });
        s.createPriceLine({ price: 30, color: colors.up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "30" });
        pushLegendValues(legendData, id, points, oscillatorFmt, color);
        indicatorSeriesRef.current.push(s);
      } else if (id === "macd") {
        const lineColor = style?.color ?? INDICATOR_COLORS.macdLine;
        const signalColor = style?.secondColor ?? INDICATOR_COLORS.macdSignal;
        const result = macd(data);
        const macdLine = chart.addLineSeries({ color: lineColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "macd", visible });
        macdLine.setData(toLineData(result.macd));
        const signalLine = chart.addLineSeries({ color: signalColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "macd", visible });
        signalLine.setData(toLineData(result.signal));
        const hist = chart.addHistogramSeries({ priceScaleId: "macd", visible });
        hist.setData(result.histogram.map((p) => ({ time: toChartTime(p.time), value: p.value, color: p.value >= 0 ? colors.up : colors.down })));
        pushLegendValues(legendData, id, result.macd, priceFmt, lineColor, "MACD");
        pushLegendValues(legendData, id, result.signal, priceFmt, signalColor, "Signal");
        indicatorSeriesRef.current.push(macdLine, signalLine, hist);
      } else if (id === "stochastic") {
        const kColor = style?.color ?? INDICATOR_COLORS.stochK;
        const dColor = style?.secondColor ?? INDICATOR_COLORS.stochD;
        const result = stochastic(data, 14, 3);
        const kSeries = chart.addLineSeries({ color: kColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "stochastic", visible });
        kSeries.setData(toLineData(result.k));
        const dSeries = chart.addLineSeries({ color: dColor, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "stochastic", visible });
        dSeries.setData(toLineData(result.d));
        kSeries.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }) });
        kSeries.createPriceLine({ price: 80, color: colors.down, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "80" });
        kSeries.createPriceLine({ price: 20, color: colors.up, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "20" });
        pushLegendValues(legendData, id, result.k, oscillatorFmt, kColor, "%K");
        pushLegendValues(legendData, id, result.d, oscillatorFmt, dColor, "%D");
        indicatorSeriesRef.current.push(kSeries, dSeries);
      } else if (id === "atr14") {
        const period = style?.period ?? INDICATOR_DEFS.find((d) => d.id === id)!.defaultPeriod!;
        const color = style?.color ?? INDICATOR_COLORS.atr14;
        const s = chart.addLineSeries({ color, lineWidth: toLineWidth(style?.lineWidth ?? 1), priceScaleId: "atr", visible });
        const points = atr(data, period);
        s.setData(toLineData(points));
        pushLegendValues(legendData, id, points, priceFmt, color);
        indicatorSeriesRef.current.push(s);
      }
    }

    // Volume's legend value tracks each candle directly (there's no separate computed series —
    // the histogram bars ARE the data), colored per-candle up/down like the bars themselves
    // (unlike every other indicator, so it doesn't go through pushLegendValues' single-color arg).
    if (showVolume) {
      const volumeMap = new Map<Time, LegendValue[]>();
      data.forEach((d) => {
        volumeMap.set(toChartTime(d.time), [
          { value: formatNumber(Math.round(d.volume)), color: d.close >= d.open ? settings.upColor : settings.downColor },
        ]);
      });
      legendData.set("volume", volumeMap);
    }
    setIndicatorLegendData(legendData);

    mainSeries.priceScale().applyOptions({ scaleMargins: paneLayout.price });
    const seriesByPane: Partial<Record<PaneKey, ISeriesApi<"Line" | "Histogram">[]>> = {
      volume: [volumeSeries],
      rsi: indicatorSeriesRef.current.filter((s) => activeIndicators.includes("rsi14") && s.options().priceScaleId === "rsi"),
      macd: indicatorSeriesRef.current.filter((s) => s.options().priceScaleId === "macd"),
      stochastic: indicatorSeriesRef.current.filter((s) => s.options().priceScaleId === "stochastic"),
      atr: indicatorSeriesRef.current.filter((s) => s.options().priceScaleId === "atr"),
    };
    (Object.entries(paneLayout.panes) as [PaneKey, { top: number; bottom: number }][]).forEach(([key, margins]) => {
      seriesByPane[key]?.forEach((s) => s.priceScale().applyOptions({ scaleMargins: margins }));
    });

    selectRange(activeRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeIndicators, hiddenIndicators, indicatorStyles, paneLayout, indicatorsLoaded, chartType, chartTypeLoaded, settings.upColor, settings.downColor, currency]);

  // Comparison symbol — fetch OHLCV via the same shared data source, refetching on interval change.
  useEffect(() => {
    if (!compareSymbol) return;
    const key = `${compareSymbol}:${activeInterval}`;
    if (compareLoadedFor === key) return;
    let cancelled = false;

    fetchChartData(compareSymbol, activeInterval).then((result) => {
      if (cancelled) return;
      if (result.candles && result.candles.length >= 2) {
        setCompareData(result.candles);
        const first = result.candles[0].close;
        const last = result.candles[result.candles.length - 1].close;
        setCompareChangePct(first > 0 ? ((last - first) / first) * 100 : null);
        setCompareError(null);
      } else {
        setCompareData([]);
        setCompareError(result.message ?? `Keine Kursdaten für ${compareSymbol} verfügbar.`);
      }
      setCompareLoadedFor(key);
    });

    return () => {
      cancelled = true;
    };
  }, [compareSymbol, activeInterval, compareLoadedFor]);

  // Comparison symbol — render as a % overlay (own price scale in Percentage mode, so different
  // price levels between the two symbols stay directly comparable, per the requirement).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (compareSeriesRef.current) {
      chart.removeSeries(compareSeriesRef.current);
      compareSeriesRef.current = null;
    }
    if (!compareSymbol || compareData.length < 2) return;

    const series = chart.addLineSeries({
      color: INDICATOR_COLORS.compare,
      lineWidth: 2,
      priceScaleId: "compare",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const priceMargins = mainSeriesRef.current?.priceScale().options().scaleMargins ?? { top: 0.08, bottom: 0.05 };
    series.priceScale().applyOptions({ mode: PriceScaleMode.Percentage, scaleMargins: priceMargins });
    series.setData(compareData.map((d) => ({ time: toChartTime(d.time), value: d.close })));
    compareSeriesRef.current = series;
  }, [compareSymbol, compareData]);

  const legendCandle = hovered ?? data[data.length - 1] ?? null;

  // Change%/date-range shown next to the symbol name — reflects the currently VISIBLE bars
  // (from visibleRange, kept live by the subscription above), not a fixed day-over-day
  // comparison. First visible bar's close is the baseline, last visible bar's close is the
  // endpoint, matching how the range buttons below already define "1D"/"1M"/etc. windows.
  const { legendChangeAbs, legendChangePercent, legendDateLabel } = useMemo(() => {
    if (data.length === 0) return { legendChangeAbs: null, legendChangePercent: null, legendDateLabel: "" };
    const clamp = (n: number) => Math.max(0, Math.min(data.length - 1, Math.round(n)));
    const fromIdx = visibleRange ? clamp(visibleRange.from) : 0;
    const toIdx = visibleRange ? Math.max(fromIdx, clamp(visibleRange.to)) : data.length - 1;
    const startCandle = data[fromIdx];
    const endCandle = data[toIdx];
    const abs = endCandle.close - startCandle.close;
    const pct = startCandle.close !== 0 ? (abs / startCandle.close) * 100 : 0;
    const dateLabel = hovered
      ? formatLegendTime(hovered.time, settings.timezone)
      : fromIdx === toIdx
        ? formatLegendTime(endCandle.time, settings.timezone)
        : `${formatLegendTime(startCandle.time, settings.timezone)} – ${formatLegendTime(endCandle.time, settings.timezone)}`;
    return { legendChangeAbs: abs, legendChangePercent: pct, legendDateLabel: dateLabel };
  }, [data, visibleRange, hovered, settings.timezone]);

  const positive = (legendChangePercent ?? 0) >= 0;
  const activeCount = activeIndicators.length;

  const priceIndicatorDefs = useMemo(
    () => INDICATOR_DEFS.filter((def) => def.pane === "price" && activeIndicators.includes(def.id)),
    [activeIndicators],
  );

  // Same crosshair-time-or-last-candle lookup the OHLC legend already uses (legendCandle above) —
  // indicator legend values move with the hovered candle for the same reason.
  function legendValuesFor(id: IndicatorId): LegendValue[] {
    if (!legendCandle) return [];
    return indicatorLegendData.get(id)?.get(toChartTime(legendCandle.time)) ?? [];
  }

  function indicatorPeriod(id: IndicatorId): number | undefined {
    const def = INDICATOR_DEFS.find((d) => d.id === id);
    if (def?.defaultPeriod === undefined) return undefined;
    return indicatorStyles[id]?.period ?? def.defaultPeriod;
  }

  // Two-line indicators need a second color field; everything else just gets one. Default colors
  // come from INDICATOR_COLORS (keyed per-line, e.g. "bollingerUpper"/"bollingerLower" rather than
  // just "bollinger") unless the user already overrode them via indicatorStyles.
  const TWO_COLOR_INDICATORS: Partial<Record<IndicatorId, { label: string; primaryKey: string; secondKey: string }>> = {
    bollinger: { label: "Unteres Band", primaryKey: "bollingerUpper", secondKey: "bollingerLower" },
    macd: { label: "Signal", primaryKey: "macdLine", secondKey: "macdSignal" },
    stochastic: { label: "%D", primaryKey: "stochK", secondKey: "stochD" },
  };

  function renderStylePopover(id: IndicatorId) {
    // Volume has no single overridable line color — its bars are colored per-candle up/down from
    // the general chart settings (settings.upColor/downColor), not a fixed indicator color like
    // every other entry here, so a color/width popover would just be misleading.
    if (id === "volume") {
      return (
        <div className="relative">
          <div className="fixed inset-0 z-30" onClick={() => setStyleEditorFor(null)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-brand-border bg-surface p-3 text-xs text-foreground/60 shadow-lg">
            Volumen-Farben folgen den Kerzenfarben aus den allgemeinen Chart-Einstellungen.
          </div>
        </div>
      );
    }
    const style = indicatorStyles[id];
    const two = TWO_COLOR_INDICATORS[id];
    const defaultColor = INDICATOR_COLORS[two?.primaryKey ?? id] ?? "#2563eb";
    const def = INDICATOR_DEFS.find((d) => d.id === id)!;
    return (
      <IndicatorStylePopover
        name={def.legendName}
        color={style?.color ?? defaultColor}
        secondColorLabel={two?.label}
        secondColor={two ? (style?.secondColor ?? INDICATOR_COLORS[two.secondKey]) : undefined}
        lineWidth={style?.lineWidth ?? (id === "rsi14" ? 2 : 1)}
        period={indicatorPeriod(id)}
        onChange={(patch) => updateIndicatorStyle(id, patch)}
        onClose={() => setStyleEditorFor(null)}
      />
    );
  }

  const filteredIndicatorDefs = useMemo(
    () => INDICATOR_DEFS.filter((def) => def.label.toLowerCase().includes(indicatorSearch.toLowerCase())),
    [indicatorSearch],
  );

  const currentTypeLabel = CHART_TYPES.find((t) => t.id === chartType)?.label ?? "Kerzen";

  return (
    <div ref={rootRef} className={cn("flex h-full flex-col border-y border-brand-border bg-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-foreground">{name ?? symbol}</span>
          {dataSource && <DataSourceBadge source={dataSource} />}
          <div className="flex items-center gap-1">
            {CHART_INTERVALS.map((option) => {
              const disabled = disabledIntervals.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectInterval(option)}
                  title={disabled ? "Für diese Granularität liegen aktuell keine Daten vor." : undefined}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                    disabled
                      ? "cursor-not-allowed text-foreground/25"
                      : activeInterval === option
                        ? "bg-brand-teal-light text-brand-teal"
                        : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTypeMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-foreground/60 hover:bg-surface-hover hover:text-foreground"
            >
              {currentTypeLabel}
              <ChevronDownIcon className="h-3 w-3" />
            </button>
            {typeMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setTypeMenuOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-2 w-48 rounded-xl border border-brand-border bg-surface p-1 shadow-lg">
                  {CHART_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => selectChartType(t.id)}
                      className={cn(
                        "block w-full rounded-lg px-2.5 py-2 text-left text-sm",
                        chartType === t.id ? "bg-brand-teal-light text-brand-teal" : "text-foreground hover:bg-surface-hover",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {compareOpen ? (
            <form onSubmit={submitCompare} className="flex items-center gap-1">
              <input
                autoFocus
                value={compareQuery}
                onChange={(e) => setCompareQuery(e.target.value)}
                placeholder="Symbol, z. B. AAPL"
                className="w-28 rounded-md border border-brand-border px-2 py-1 text-xs outline-none focus:border-brand-teal"
              />
              <button type="submit" className="rounded-md bg-brand-teal px-2 py-1 text-xs font-semibold text-white">
                OK
              </button>
              <button
                type="button"
                onClick={() => setCompareOpen(false)}
                aria-label="Abbrechen"
                className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/40 hover:bg-surface-hover hover:text-foreground"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-brand-border px-2.5 py-1 text-xs font-semibold text-foreground/60 hover:bg-surface-hover hover:text-foreground"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Vergleichen
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setIndicatorMenuOpen((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                activeCount > 0
                  ? "border-brand-teal bg-brand-teal-light text-brand-teal"
                  : "border-brand-border text-foreground/60 hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <SlidersIcon className="h-3.5 w-3.5" />
              Indikatoren{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            {indicatorMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIndicatorMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-brand-border bg-surface p-2 shadow-lg">
                  <div className="mb-1.5 flex items-center gap-2 rounded-md border border-brand-border px-2 py-1">
                    <SearchIcon className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
                    <input
                      value={indicatorSearch}
                      onChange={(e) => setIndicatorSearch(e.target.value)}
                      placeholder="Indikator suchen…"
                      className="w-full text-xs outline-none"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredIndicatorDefs.map((def) => (
                      <label
                        key={def.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground hover:bg-surface-hover"
                      >
                        <input
                          type="checkbox"
                          checked={activeIndicators.includes(def.id)}
                          onChange={() => toggleIndicator(def.id)}
                          className="h-4 w-4 accent-brand-teal"
                        />
                        {def.label}
                      </label>
                    ))}
                    {filteredIndicatorDefs.length === 0 && (
                      <p className="px-2.5 py-3 text-center text-xs text-foreground/40">Keine Treffer.</p>
                    )}
                  </div>
                  <div className="mt-1 border-t border-brand-border px-2.5 pt-2 text-[11px] text-foreground/40">
                    Auswahl wird als Favorit gespeichert und beim nächsten Öffnen automatisch angezeigt.
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mx-0.5 h-5 w-px bg-brand-border" />

          <button
            type="button"
            onClick={resetDrawingTool}
            aria-label="Cursor"
            title="Cursor"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              activeTool === "cursor"
                ? "bg-brand-teal-light text-brand-teal"
                : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <CursorIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingPointA(null);
              setCursorPoint(null);
              setActiveTool((prev) => (prev === "horizontal-line" ? "cursor" : "horizontal-line"));
            }}
            aria-label="Horizontale Linie"
            title="Horizontale Linie"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              activeTool === "horizontal-line"
                ? "bg-brand-teal-light text-brand-teal"
                : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <HorizontalLineIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setPendingPointA(null);
              setCursorPoint(null);
              setActiveTool((prev) => (prev === "trend-line" ? "cursor" : "trend-line"));
            }}
            aria-label="Trendlinie"
            title="Trendlinie"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
              activeTool === "trend-line"
                ? "bg-brand-teal-light text-brand-teal"
                : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
            )}
          >
            <TrendLineIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={clearAllDrawings}
            disabled={drawings.length === 0}
            aria-label="Zeichnungen löschen"
            title="Zeichnungen löschen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/20 disabled:hover:bg-transparent"
          >
            <TrashIcon className="h-4 w-4" />
          </button>

          <div className="mx-0.5 h-5 w-px bg-brand-border" />

          <button
            type="button"
            onClick={undo}
            disabled={undoStack.length === 0}
            aria-label="Rückgängig"
            title="Rückgängig"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/20 disabled:hover:bg-transparent"
          >
            <UndoIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={redoStack.length === 0}
            aria-label="Wiederholen"
            title="Wiederholen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/20 disabled:hover:bg-transparent"
          >
            <RedoIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={takeScreenshot}
            aria-label="Screenshot herunterladen"
            title="Screenshot herunterladen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground"
          >
            <CameraIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Chart-Einstellungen"
            title="Chart-Einstellungen"
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground"
          >
            <GearIcon className="h-4 w-4" />
          </button>
          {toolbarExtra && (
            <>
              <div className="mx-0.5 h-5 w-px bg-brand-border" />
              {toolbarExtra}
            </>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Vollbild beenden" : "Vollbild"}
            title={fullscreen ? "Vollbild beenden" : "Vollbild"}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 hover:bg-surface-hover hover:text-foreground"
          >
            {fullscreen ? <FullscreenExitIcon className="h-4 w-4" /> : <FullscreenIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute left-3 top-2 z-10 max-w-[92%] text-[11px] font-medium leading-relaxed text-foreground/70">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-foreground">{symbol}</span>
            {legendChangeAbs !== null && legendChangePercent !== null && (
              <span className={cn("font-semibold", positive ? "text-risk-low" : "text-risk-high")}>
                {positive ? "+" : ""}
                {formatCurrency(legendChangeAbs, currency)} ({positive ? "+" : ""}
                {legendChangePercent.toFixed(2)} %)
              </span>
            )}
            <span className="text-foreground/40">· {activeInterval}</span>
            {legendDateLabel && <span className="text-foreground/40">· {legendDateLabel}</span>}
          </div>
          {legendCandle && (
            <div className="mt-0.5 flex flex-wrap gap-x-2.5">
              <span>
                O <span className="font-semibold text-foreground">{formatCurrency(legendCandle.open, currency)}</span>
              </span>
              <span>
                H <span className="font-semibold text-foreground">{formatCurrency(legendCandle.high, currency)}</span>
              </span>
              <span>
                L <span className="font-semibold text-foreground">{formatCurrency(legendCandle.low, currency)}</span>
              </span>
              <span>
                C <span className="font-semibold text-foreground">{formatCurrency(legendCandle.close, currency)}</span>
              </span>
              <span>
                Vol{" "}
                <span className="font-semibold text-foreground">{formatNumber(Math.round(legendCandle.volume))}</span>
              </span>
            </div>
          )}
          {priceIndicatorDefs.length > 0 && (
            <div className="pointer-events-auto mt-0.5 flex flex-col gap-0.5">
              {priceIndicatorDefs.map((def) => (
                <div key={def.id} className="relative">
                  <IndicatorLegendRow
                    name={def.legendName}
                    period={indicatorPeriod(def.id)}
                    values={legendValuesFor(def.id)}
                    visible={!hiddenIndicators.includes(def.id)}
                    onToggleVisible={() => toggleIndicatorVisibility(def.id)}
                    onOpenStyle={() => setStyleEditorFor(styleEditorFor === def.id ? null : def.id)}
                    onRemove={() => removeIndicator(def.id)}
                  />
                  {styleEditorFor === def.id && renderStylePopover(def.id)}
                </div>
              ))}
            </div>
          )}
          {compareSymbol && (
            <div className="pointer-events-auto mt-1 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: INDICATOR_COLORS.compare }} />
              <span className="font-semibold text-foreground">{compareSymbol}</span>
              {compareChangePct !== null && (
                <span className={cn("font-semibold", compareChangePct >= 0 ? "text-risk-low" : "text-risk-high")}>
                  {compareChangePct >= 0 ? "+" : ""}
                  {compareChangePct.toFixed(2)} %
                </span>
              )}
              {compareError && <span className="text-risk-high">{compareError}</span>}
              <button
                type="button"
                onClick={removeCompare}
                aria-label={`${compareSymbol} entfernen`}
                className="text-foreground/40 hover:text-foreground"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Pane separator lines + per-pane indicator legend rows — positioned with the exact same
            top fraction (as a CSS %, so it stays correct across resize/fullscreen without its own
            recompute) that paneLayout.panes already applies to that pane's series' scaleMargins;
            the two can never drift apart since both read the same memo. */}
        {(Object.entries(paneLayout.panes) as [PaneKey, { top: number; bottom: number }][]).map(([key, margin]) => {
          const paneIndicatorDefs = INDICATOR_DEFS.filter((def) => def.pane === key && activeIndicators.includes(def.id));
          if (paneIndicatorDefs.length === 0) return null;
          return (
            <div key={key} className="pointer-events-none absolute inset-x-0 z-10" style={{ top: `${margin.top * 100}%` }}>
              <div className="h-px w-full" style={{ background: "var(--chart-border)" }} />
              <div className="pointer-events-auto flex flex-col gap-0.5 px-3 pt-1">
                {paneIndicatorDefs.map((def) => (
                  <div key={def.id} className="relative">
                    <IndicatorLegendRow
                      name={def.legendName}
                      period={indicatorPeriod(def.id)}
                      values={legendValuesFor(def.id)}
                      visible={!hiddenIndicators.includes(def.id)}
                      onToggleVisible={() => toggleIndicatorVisibility(def.id)}
                      onOpenStyle={() => setStyleEditorFor(styleEditorFor === def.id ? null : def.id)}
                      onRemove={() => removeIndicator(def.id)}
                    />
                    {styleEditorFor === def.id && renderStylePopover(def.id)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Always mounted (even with no data yet) — the chart-init effect binds to this ref on mount,
            so conditionally swapping it out for a placeholder would leave lightweight-charts never
            initialized once data arrives later (exactly what happened before this was fixed).
            Absolutely positioned to fill this relative flex-1 parent — that's what lets the chart
            take the parent's full available height via ResizeObserver instead of a fixed pixel value. */}
        <div ref={containerRef} className="absolute inset-0" style={{ minHeight: height }} />

        {/* Drawing-tool overlay — lightweight-charts v4 has no arbitrary-line primitive, so trend
            lines are hand-drawn here. pointer-events-none throughout: chart.subscribeClick fires
            from lightweight-charts' own internal canvas regardless of what's stacked visually on
            top, so this canvas never needs to capture clicks itself. */}
        <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 z-[5]" />

        {data.length < 2 && !loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface px-6 text-center text-sm text-foreground/50">
            Keine Chart-Daten für diesen Zeitraum verfügbar.
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/90 px-6 text-center backdrop-blur-sm">
            <p className="max-w-sm text-sm text-foreground/60">{loadError}</p>
          </div>
        )}
        {loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
            <p className="text-sm text-foreground/50">Lade Kursdaten…</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-brand-border px-3 py-1.5">
        {VISIBLE_RANGES.map((range) => {
          const disabled = disabledIntervals.includes(range.interval);
          return (
            <button
              key={range.id}
              type="button"
              disabled={disabled}
              onClick={() => selectRange(range.id)}
              title={disabled ? "Für diese Granularität liegen aktuell keine Daten vor." : undefined}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors",
                disabled
                  ? "cursor-not-allowed text-foreground/25"
                  : activeRange === range.id
                    ? "bg-brand-teal-light text-brand-teal"
                    : "text-foreground/50 hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {range.id}
            </button>
          );
        })}
      </div>

      <ChartSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        onReset={resetSettings}
      />
    </div>
  );
}
