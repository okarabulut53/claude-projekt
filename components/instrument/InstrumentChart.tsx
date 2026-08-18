"use client";

import { CandleDatum } from "@/components/charts/CandlestickChart";
import { ChartWorkspace } from "@/components/charts/ChartWorkspace";

export function InstrumentChart({
  symbol,
  name,
  currency,
  initialPrice,
  initialChangePercent,
  initialCandles,
  isLive,
}: {
  symbol: string;
  name: string;
  currency: "EUR" | "USD";
  initialPrice: number;
  initialChangePercent: number;
  initialCandles: CandleDatum[];
  isLive: boolean;
}) {
  return (
    <div className="h-[75vh] min-h-[480px]">
      <ChartWorkspace
        symbol={symbol}
        name={name}
        currency={currency}
        initialPrice={initialPrice}
        initialChangePercent={initialChangePercent}
        initialCandles={initialCandles}
        isLive={isLive}
        className="h-full"
      />
    </div>
  );
}
