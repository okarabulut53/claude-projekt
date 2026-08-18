"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { IChartApi, ISeriesApi, SeriesType } from "lightweight-charts";
import { cn } from "@/lib/cn";
import { fetchInstrumentQuote } from "@/lib/actions/instrument";
import { fetchChartData } from "@/lib/chart-client";
import { syntheticCandlesFromPricePoints } from "@/lib/chart-transform";
import { liveSymbols } from "@/lib/market-data/symbols";
import { Instrument } from "@/lib/types";
import { CandleDatum, CandlestickChart, ChartInterval, ChartType } from "./CandlestickChart";
import { LayoutGridIcon, SearchIcon } from "@/components/icons/Icons";

const LAYOUT_COUNTS = [1, 2, 3, 4, 6, 8, 9, 12, 16] as const;
type LayoutCount = (typeof LAYOUT_COUNTS)[number];

const LAYOUT_VARIANTS = [
  { id: "grid", label: "Raster" },
  { id: "rows", label: "Gestapelt" },
  { id: "cols", label: "Nebeneinander" },
] as const;
type LayoutVariant = (typeof LAYOUT_VARIANTS)[number]["id"];

interface SyncSettings {
  symbol: boolean;
  interval: boolean;
  chartType: boolean;
  crosshair: boolean;
  time: boolean;
  range: boolean;
}

const DEFAULT_SYNC: SyncSettings = {
  symbol: false,
  interval: true,
  chartType: false,
  crosshair: true,
  time: true,
  range: true,
};

const LAYOUT_STORAGE_KEY = "finara-chart-layout";

interface PaneState {
  id: string;
  symbol: string;
  interval: ChartInterval;
  chartType: ChartType;
  /** Bars requested from the API for the current interval — grows when a range button (e.g.
   *  "5Y") needs more history than the default fetch loaded; see CandlestickChart's selectRange. */
  outputsize: number;
}

function loadLayoutPrefs(): { count: LayoutCount; variant: LayoutVariant; sync: SyncSettings } {
  const fallback = { count: 1 as LayoutCount, variant: "grid" as LayoutVariant, sync: DEFAULT_SYNC };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return {
      count: LAYOUT_COUNTS.includes(parsed.count) ? parsed.count : fallback.count,
      variant: LAYOUT_VARIANTS.some((v) => v.id === parsed.variant) ? parsed.variant : fallback.variant,
      sync: { ...DEFAULT_SYNC, ...parsed.sync },
    };
  } catch {
    return fallback;
  }
}

function gridTemplate(count: number, variant: LayoutVariant): { gridTemplateColumns: string; gridTemplateRows: string } {
  if (variant === "cols") return { gridTemplateColumns: `repeat(${count}, 1fr)`, gridTemplateRows: "1fr" };
  if (variant === "rows") return { gridTemplateColumns: "1fr", gridTemplateRows: `repeat(${count}, 1fr)` };
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` };
}

interface InitialPaneData {
  price: number;
  changePercent: number;
  candles: CandleDatum[];
}

interface WorkspacePaneProps {
  pane: PaneState;
  /** Server-prefetched data for this exact symbol+interval — skips the first (rate-limited) OHLCV fetch. */
  initial?: InitialPaneData;
  onSymbolChange: (id: string, symbol: string) => void;
  onIntervalChange: (id: string, interval: ChartInterval, outputsize?: number) => void;
  onChartTypeChange: (id: string, type: ChartType) => void;
  onChartReady: (id: string, chart: IChartApi, series: ISeriesApi<SeriesType>) => void;
  /** Fires whenever this pane resolves (or fails to resolve) its instrument — only wired for pane 0. */
  onInstrumentResolved?: (instrument: Instrument | null) => void;
  /** Workspace-level toolbar content (the Layout control) — only wired for pane 0, since it
   *  applies to the whole grid, not any single pane. */
  toolbarExtra?: ReactNode;
}

function WorkspacePane({
  pane,
  initial,
  onSymbolChange,
  onIntervalChange,
  onChartTypeChange,
  onChartReady,
  onInstrumentResolved,
  toolbarExtra,
}: WorkspacePaneProps) {
  const [query, setQuery] = useState(pane.symbol);
  const [prevSymbol, setPrevSymbol] = useState(pane.symbol);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [resolvedFor, setResolvedFor] = useState<string | null>(null);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [changePercent, setChangePercent] = useState(initial?.changePercent ?? 0);
  const [candles, setCandles] = useState<CandleDatum[]>(initial?.candles ?? []);
  const [chartResolvedKey, setChartResolvedKey] = useState<string | null>(
    initial ? `${pane.symbol}:${pane.interval}:${pane.outputsize}` : null,
  );
  const [chartLoadError, setChartLoadError] = useState<string | null>(null);

  if (pane.symbol !== prevSymbol) {
    setPrevSymbol(pane.symbol);
    setQuery(pane.symbol);
    setChartLoadError(null);
  }

  const isLive = Boolean(liveSymbols[pane.symbol]);
  const baseLoading = resolvedFor !== pane.symbol;
  const notFound = !baseLoading && instrument === null;
  const chartKey = `${pane.symbol}:${pane.interval}:${pane.outputsize}`;
  const chartLoading = !baseLoading && chartResolvedKey !== chartKey;

  useEffect(() => {
    if (resolvedFor === pane.symbol) return;
    let cancelled = false;
    fetchInstrumentQuote(pane.symbol).then((result) => {
      if (cancelled) return;
      setInstrument(result);
      setResolvedFor(pane.symbol);
      onInstrumentResolved?.(result);
      if (result) {
        setPrice(result.price);
        setChangePercent(result.changePercent1d);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pane.symbol, resolvedFor, onInstrumentResolved]);

  useEffect(() => {
    if (!instrument || resolvedFor !== pane.symbol || chartResolvedKey === chartKey) return;
    let cancelled = false;

    async function load() {
      if (!isLive) {
        if (cancelled) return;
        setCandles(syntheticCandlesFromPricePoints(pane.symbol, instrument!.history));
        setChartLoadError(null);
        setChartResolvedKey(chartKey);
        return;
      }
      const result = await fetchChartData(pane.symbol, pane.interval, pane.outputsize);
      if (cancelled) return;
      if (result.quote) {
        setPrice(result.quote.price);
        setChangePercent(result.quote.changePercent1d);
      }
      if (result.candles) {
        setCandles(result.candles);
        setChartLoadError(null);
      } else {
        setCandles(syntheticCandlesFromPricePoints(pane.symbol, instrument!.history));
        setChartLoadError(result.message ?? "Kursdaten konnten nicht geladen werden.");
      }
      setChartResolvedKey(chartKey);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [instrument, resolvedFor, pane.symbol, pane.interval, pane.outputsize, chartKey, chartResolvedKey, isLive]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const sym = query.trim().toUpperCase();
    if (sym) onSymbolChange(pane.id, sym);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-brand-border">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 border-b border-brand-border bg-surface px-2 py-1.5">
        <SearchIcon className="h-3.5 w-3.5 shrink-0 text-foreground/40" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Symbol"
          className="w-full min-w-0 bg-transparent text-xs font-medium text-foreground outline-none"
        />
      </form>
      <div className="min-h-0 flex-1">
        {baseLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-foreground/40">Lade…</div>
        ) : notFound ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-foreground/40">
            Kein Instrument &quot;{pane.symbol}&quot; gefunden.
          </div>
        ) : (
          <CandlestickChart
            symbol={instrument!.symbol}
            name={instrument!.name}
            data={candles}
            currency={instrument!.currency}
            interval={pane.interval}
            onIntervalChange={(next, outputsize) => onIntervalChange(pane.id, next, outputsize)}
            disabledIntervals={isLive ? [] : ["5m", "1h"]}
            dataSource={instrument!.source}
            chartType={pane.chartType}
            onChartTypeChange={(next) => onChartTypeChange(pane.id, next)}
            onChartReady={(chart, series) => onChartReady(pane.id, chart, series)}
            loading={chartLoading}
            loadError={chartLoadError}
            className="h-full border-0"
            toolbarExtra={toolbarExtra}
          />
        )}
      </div>
    </div>
  );
}

export function ChartWorkspace({
  symbol,
  initialPrice,
  initialChangePercent,
  initialCandles,
  onPrimaryInstrumentChange,
  className,
}: {
  symbol: string;
  /** Kept in the props contract for callers migrating from a single CandlestickChart, even though
   *  each pane re-resolves its own name/currency/liveness from its (possibly re-typed) symbol. */
  name?: string;
  currency?: "EUR" | "USD";
  /** Server-prefetched pane-0 data (skips its first OHLCV fetch) — omit entirely for callers
   *  with no real prefetch (e.g. a client-only chat panel); a non-empty initialCandles is what
   *  actually gates the fast path below, so passing `[]` here is equivalent to omitting it. */
  initialPrice?: number;
  initialChangePercent?: number;
  initialCandles?: CandleDatum[];
  isLive?: boolean;
  /** Fires whenever pane 0's resolved instrument changes — lets a host (e.g. FinaraAI's chat
   *  chart panel) keep its own "currently shown instrument" state in sync without needing its
   *  own duplicate symbol-resolution logic alongside this component's per-pane search box. */
  onPrimaryInstrumentChange?: (instrument: Instrument | null) => void;
  className?: string;
}) {
  const [layoutCount, setLayoutCount] = useState<LayoutCount>(1);
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>("grid");
  const [sync, setSync] = useState<SyncSettings>(DEFAULT_SYNC);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);

  const [panes, setPanes] = useState<PaneState[]>([
    { id: "pane-0", symbol, interval: "1D", chartType: "candlestick", outputsize: 200 },
  ]);

  // Pane 0 follows the externally-controlled `symbol` prop (e.g. a watchlist click swapping
  // the chart from outside) — but only when that prop itself changes; the pane's own search
  // box drives its symbol independently otherwise (via handleSymbolChange below). Adjusted
  // during render, same pattern as the layoutCount sync further down.
  const [lastExternalSymbol, setLastExternalSymbol] = useState(symbol);
  if (symbol !== lastExternalSymbol) {
    setLastExternalSymbol(symbol);
    setPanes((prev) => (prev[0]?.symbol === symbol ? prev : prev.map((p, i) => (i === 0 ? { ...p, symbol } : p))));
  }

  const chartRefs = useRef(new Map<string, { chart: IChartApi; series: ISeriesApi<SeriesType> }>());
  const [readyTick, setReadyTick] = useState(0);
  const isSyncingViewRef = useRef(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      const prefs = loadLayoutPrefs();
      setLayoutCount(prefs.count);
      setLayoutVariant(prefs.variant);
      setSync(prefs.sync);
    });
  }, []);

  function savePrefs(next: { count?: LayoutCount; variant?: LayoutVariant; sync?: SyncSettings }) {
    const merged = { count: layoutCount, variant: layoutVariant, sync, ...next };
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(merged));
  }

  // Keep the pane array in sync with the selected pane count. New panes default to pane 0's
  // symbol/interval/type. Adjusted during render (not an effect) — this is purely derived from
  // `layoutCount`, so there's nothing async to synchronize with an external system.
  const [resizedForCount, setResizedForCount] = useState<LayoutCount>(1);
  if (layoutCount !== resizedForCount) {
    setResizedForCount(layoutCount);
    setPanes((prev) => {
      if (prev.length === layoutCount) return prev;
      if (prev.length < layoutCount) {
        const template = prev[0];
        const extra = Array.from({ length: layoutCount - prev.length }, (_, i) => ({
          id: `pane-${prev.length + i}`,
          symbol: template.symbol,
          interval: template.interval,
          chartType: template.chartType,
          outputsize: template.outputsize,
        }));
        return [...prev, ...extra];
      }
      return prev.slice(0, layoutCount);
    });
  }

  function selectLayoutCount(count: LayoutCount) {
    setLayoutCount(count);
    savePrefs({ count });
  }

  function selectLayoutVariant(variant: LayoutVariant) {
    setLayoutVariant(variant);
    savePrefs({ variant });
  }

  function toggleSync(key: keyof SyncSettings) {
    setSync((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs({ sync: next });
      return next;
    });
  }

  function updatePaneField(id: string, field: keyof PaneState, value: string, syncOn: boolean) {
    setPanes((prev) =>
      prev.map((p) => {
        if (syncOn) return { ...p, [field]: value };
        return p.id === id ? { ...p, [field]: value } : p;
      }),
    );
  }

  const handleSymbolChange = (id: string, value: string) => updatePaneField(id, "symbol", value, sync.symbol);
  const handleChartTypeChange = (id: string, value: ChartType) => updatePaneField(id, "chartType", value, sync.chartType);

  // Sets interval + outputsize together (unlike updatePaneField's single-field updates) — a
  // range button like "5Y" needs both changed atomically, and even a plain top-toolbar interval
  // click needs outputsize reset to a sane default rather than left over from whatever range was
  // previously active.
  function handleIntervalChange(id: string, interval: ChartInterval, outputsize?: number) {
    setPanes((prev) =>
      prev.map((p) => {
        const next = { ...p, interval, outputsize: outputsize ?? 200 };
        if (sync.interval) return next;
        return p.id === id ? next : p;
      }),
    );
  }

  function handleChartReady(id: string, chart: IChartApi, series: ISeriesApi<SeriesType>) {
    chartRefs.current.set(id, { chart, series });
    setReadyTick((t) => t + 1);
  }

  // Crosshair + time/range sync across panes, using each pane's raw chart instance.
  useEffect(() => {
    if (!sync.crosshair && !sync.time && !sync.range) return;
    const entries = Array.from(chartRefs.current.entries());
    if (entries.length < 2) return;
    const cleanups: (() => void)[] = [];

    entries.forEach(([id, { chart }]) => {
      if (sync.crosshair) {
        const handler: Parameters<IChartApi["subscribeCrosshairMove"]>[0] = (param) => {
          if (isSyncingViewRef.current) return;
          isSyncingViewRef.current = true;
          entries.forEach(([otherId, other]) => {
            if (otherId === id) return;
            if (param.time) other.chart.setCrosshairPosition(0, param.time, other.series);
            else other.chart.clearCrosshairPosition();
          });
          isSyncingViewRef.current = false;
        };
        chart.subscribeCrosshairMove(handler);
        cleanups.push(() => chart.unsubscribeCrosshairMove(handler));
      }
      if (sync.time || sync.range) {
        const handler: Parameters<ReturnType<IChartApi["timeScale"]>["subscribeVisibleLogicalRangeChange"]>[0] = (
          range,
        ) => {
          if (!range || isSyncingViewRef.current) return;
          isSyncingViewRef.current = true;
          entries.forEach(([otherId, other]) => {
            if (otherId === id) return;
            other.chart.timeScale().setVisibleLogicalRange(range);
          });
          isSyncingViewRef.current = false;
        };
        chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
        cleanups.push(() => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler));
      }
    });

    return () => cleanups.forEach((fn) => fn());
  }, [sync.crosshair, sync.time, sync.range, readyTick, panes.length]);

  const gridStyle = useMemo(() => gridTemplate(layoutCount, layoutVariant), [layoutCount, layoutVariant]);

  // Rendered only into pane 0's toolbar (via WorkspacePane's toolbarExtra) — this control
  // applies to the whole grid, not any single pane, so it has no natural home of its own; it
  // used to be a separate row above the grid, now it sits next to pane 0's Fullscreen button.
  const layoutControls = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setLayoutMenuOpen((v) => !v)}
        aria-label="Layout"
        title="Layout"
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors",
          layoutCount > 1
            ? "bg-brand-teal-light text-brand-teal"
            : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
        )}
      >
        <LayoutGridIcon className="h-3.5 w-3.5" />
        Layout{layoutCount > 1 ? ` (${layoutCount})` : ""}
      </button>
      {layoutMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setLayoutMenuOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-brand-border bg-surface p-3 shadow-lg">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
              Anzahl Charts
            </div>
            <div className="mb-3 grid grid-cols-5 gap-1">
              {LAYOUT_COUNTS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => selectLayoutCount(count)}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-semibold transition-colors",
                    layoutCount === count
                      ? "bg-brand-teal-light text-brand-teal"
                      : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {count}
                </button>
              ))}
            </div>

            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
              Anordnung
            </div>
            <div className="mb-3 grid grid-cols-3 gap-1">
              {LAYOUT_VARIANTS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => selectLayoutVariant(v.id)}
                  disabled={layoutCount === 1}
                  className={cn(
                    "rounded-md py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    layoutVariant === v.id
                      ? "bg-brand-teal-light text-brand-teal"
                      : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="mb-1.5 border-t border-brand-border pt-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">
              Synchronisieren
            </div>
            <div className="space-y-1">
              {(
                [
                  ["symbol", "Symbol"],
                  ["interval", "Intervall"],
                  ["chartType", "Chart-Typ"],
                  ["crosshair", "Fadenkreuz"],
                  ["time", "Zeit"],
                  ["range", "Datumsbereich"],
                ] as [keyof SyncSettings, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1.5 py-1 text-sm text-foreground hover:bg-surface-hover"
                >
                  {label}
                  <input
                    type="checkbox"
                    checked={sync[key]}
                    onChange={() => toggleSync(key)}
                    className="h-4 w-4 accent-brand-teal"
                  />
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={cn("grid h-full min-h-0 gap-1 bg-brand-border p-1", className)} style={gridStyle}>
      {panes.map((pane, i) => (
        <WorkspacePane
          key={pane.id}
          pane={pane}
          initial={
            i === 0 &&
            pane.symbol === symbol &&
            pane.interval === "1D" &&
            pane.outputsize === 200 &&
            initialCandles &&
            initialCandles.length > 0
              ? { price: initialPrice ?? 0, changePercent: initialChangePercent ?? 0, candles: initialCandles }
              : undefined
          }
          onSymbolChange={handleSymbolChange}
          onIntervalChange={handleIntervalChange}
          onChartTypeChange={handleChartTypeChange}
          onChartReady={handleChartReady}
          onInstrumentResolved={i === 0 ? onPrimaryInstrumentChange : undefined}
          toolbarExtra={i === 0 ? layoutControls : undefined}
        />
      ))}
    </div>
  );
}
