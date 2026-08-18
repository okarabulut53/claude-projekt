"use client";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-foreground">
      {label}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 cursor-pointer rounded border border-brand-border bg-transparent"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-foreground">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-16 rounded-lg border border-brand-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-brand-teal"
      />
    </label>
  );
}

/** Compact per-indicator style popover, anchored at the legend row's gear icon — same dropdown-
 *  panel look as ChartWorkspace's Layout control (`rounded-xl border ... shadow-lg`). Changes
 *  apply immediately (no separate "done" step) since each field's onChange already writes through
 *  to CandlestickChart's indicatorStyles state, which is a data-effect dependency. */
export function IndicatorStylePopover({
  name,
  color,
  secondColorLabel,
  secondColor,
  lineWidth,
  period,
  onChange,
  onClose,
}: {
  name: string;
  color: string;
  /** Present only for two-line indicators (Bollinger/MACD/Stochastic). */
  secondColorLabel?: string;
  secondColor?: string;
  lineWidth: number;
  /** Present only for single-period indicators (SMA/EMA/RSI/ATR). */
  period?: number;
  onChange: (patch: { color?: string; secondColor?: string; lineWidth?: number; period?: number }) => void;
  onClose: () => void;
}) {
  return (
    <div className="relative">
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-brand-border bg-surface p-3 shadow-lg">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">{name}</div>
        <div className="divide-y divide-brand-border/60">
          <ColorField label={secondColorLabel ? "Farbe (1)" : "Farbe"} value={color} onChange={(v) => onChange({ color: v })} />
          {secondColorLabel && secondColor !== undefined && (
            <ColorField label={secondColorLabel} value={secondColor} onChange={(v) => onChange({ secondColor: v })} />
          )}
          <NumberField label="Linienbreite" value={lineWidth} min={1} max={4} onChange={(v) => onChange({ lineWidth: v })} />
          {period !== undefined && (
            <NumberField label="Periode" value={period} min={2} max={200} onChange={(v) => onChange({ period: v })} />
          )}
        </div>
      </div>
    </div>
  );
}
