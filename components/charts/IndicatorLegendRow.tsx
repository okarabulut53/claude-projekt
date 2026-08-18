"use client";

import { ChevronDownIcon, CloseIcon, EyeIcon, EyeOffIcon, GearIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

export interface IndicatorLegendValue {
  label?: string;
  value: string;
  color: string;
}

/** One row per active indicator, shown at the top of its pane (or stacked under the OHLC legend
 *  for price-overlay indicators). Icons only reveal on hover (`group`/`group-hover:opacity-100`,
 *  same pattern as ResizeHandle's collapse buttons) so the legend stays compact when idle. */
export function IndicatorLegendRow({
  name,
  period,
  values,
  visible,
  onToggleVisible,
  onOpenStyle,
  onRemove,
}: {
  name: string;
  period?: number;
  values: IndicatorLegendValue[];
  visible: boolean;
  onToggleVisible: () => void;
  onOpenStyle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="group flex items-center gap-1.5 rounded px-0.5 text-[11px] font-medium leading-relaxed hover:bg-surface-hover/60">
      <span className={cn("flex items-center gap-0.5", !visible && "opacity-40")}>
        <span className="text-foreground/70">
          {name}
          {period !== undefined ? ` (${period})` : ""}
        </span>
        <ChevronDownIcon className="h-3 w-3 text-foreground/40" />
      </span>

      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onToggleVisible}
          aria-label={visible ? `${name} ausblenden` : `${name} einblenden`}
          title={visible ? "Ausblenden" : "Einblenden"}
          className="flex h-5 w-5 items-center justify-center rounded text-foreground/50 hover:bg-surface-hover hover:text-foreground"
        >
          {visible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onOpenStyle}
          aria-label={`${name} Style-Einstellungen`}
          title="Style-Einstellungen"
          className="flex h-5 w-5 items-center justify-center rounded text-foreground/50 hover:bg-surface-hover hover:text-foreground"
        >
          <GearIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${name} entfernen`}
          title="Entfernen"
          className="flex h-5 w-5 items-center justify-center rounded text-foreground/50 hover:bg-surface-hover hover:text-risk-high"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </span>

      {visible &&
        values.map((v, i) => (
          <span key={i} className="font-semibold" style={{ color: v.color }}>
            {v.label ? `${v.label} ` : ""}
            {v.value}
          </span>
        ))}
    </div>
  );
}
