"use client";

import { useCallback } from "react";
import { Instrument } from "@/lib/types";
import { ChartWorkspace } from "@/components/charts/ChartWorkspace";

export function ChatChartPanel({
  symbol,
  onSymbolChange,
  onInstrumentChange,
}: {
  symbol: string | null;
  onSymbolChange: (symbol: string) => void;
  onInstrumentChange: (instrument: Instrument | null) => void;
}) {
  // Stable identity — ChartWorkspace forwards this into a useEffect dependency array, so a
  // fresh reference on every render would cause that effect to refire (and refetch) constantly.
  const handlePrimaryInstrumentChange = useCallback(
    (instrument: Instrument | null) => {
      onInstrumentChange(instrument);
      if (instrument) onSymbolChange(instrument.symbol);
    },
    [onInstrumentChange, onSymbolChange],
  );

  // ChartWorkspace owns its own per-pane symbol search box and gives this the full feature set
  // (Layout/multi-chart, drawing tools, indicators, undo/redo, screenshot, fullscreen) —
  // everything chart-related lives here in FinaraAI now, not on a separate /instrument/[symbol]
  // page the user has no way to navigate to. Collapsing this panel is handled by ChatShell
  // shrinking its column width, not by unmounting this component — so chart state (symbol,
  // drawings, indicators) survives a collapse/expand cycle.
  return (
    <ChartWorkspace
      symbol={symbol ?? "SAP"}
      onPrimaryInstrumentChange={handlePrimaryInstrumentChange}
      className="h-full"
    />
  );
}
