"use client";

import { useId, useState } from "react";
import { PricePoint } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function LineChart({
  data,
  positive,
  height = 260,
  currencyLabel = "",
}: {
  data: PricePoint[];
  positive: boolean;
  height?: number;
  currencyLabel?: string;
}) {
  const gradientId = useId();
  const width = 640;
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (data.length < 2) return null;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const padding = 8;

  const coords = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + (height - padding * 2) * (1 - (d.price - min) / range);
    return { x, y, point: d };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const color = positive ? "var(--risk-low)" : "var(--risk-high)";
  const active = hoverIndex !== null ? coords[hoverIndex] : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        onMouseLeave={() => setHoverIndex(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (data.length - 1));
          setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {active && (
          <line x1={active.x} x2={active.x} y1={0} y2={height} stroke="var(--brand-border)" strokeWidth={1} />
        )}
        {active && <circle cx={active.x} cy={active.y} r={4} fill={color} stroke="white" strokeWidth={2} />}
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border border-brand-border bg-surface px-3 py-1.5 text-xs shadow-md"
          style={{
            left: `${Math.min(Math.max((active.x / width) * 100, 10), 90)}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <div className="font-semibold text-foreground">
            {active.point.price.toLocaleString("de-DE", { maximumFractionDigits: 2 })} {currencyLabel}
          </div>
          <div className="text-foreground/50">{formatDate(active.point.date)}</div>
        </div>
      )}
    </div>
  );
}
