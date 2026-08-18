"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CloseIcon } from "@/components/icons/Icons";
import { ChartSettings, TIMEZONES } from "./chartSettings";

const TABS = ["Stil", "Achsen", "Hintergrund", "Zeitzone"] as const;
type Tab = (typeof TABS)[number];

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

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5 text-sm text-foreground">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-teal"
      />
    </label>
  );
}

export function ChartSettingsDialog({
  open,
  onClose,
  settings,
  onChange,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  settings: ChartSettings;
  onChange: (patch: Partial<ChartSettings>) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Stil");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-3">
          <span className="text-sm font-bold text-foreground">Chart-Einstellungen</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-7 w-7 items-center justify-center rounded-full text-foreground/40 hover:bg-surface-hover hover:text-foreground"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-brand-border px-3 py-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                tab === t
                  ? "bg-brand-teal-light text-brand-teal"
                  : "text-foreground/60 hover:bg-surface-hover hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="max-h-96 overflow-y-auto px-4 py-3">
          {tab === "Stil" && (
            <div className="divide-y divide-brand-border/60">
              <ColorField label="Farbe steigend" value={settings.upColor} onChange={(v) => onChange({ upColor: v })} />
              <ColorField label="Farbe fallend" value={settings.downColor} onChange={(v) => onChange({ downColor: v })} />
              <ToggleField
                label="Preislinie anzeigen"
                checked={settings.priceLineVisible}
                onChange={(v) => onChange({ priceLineVisible: v })}
              />
              {settings.priceLineVisible && (
                <ColorField
                  label="Farbe Preislinie"
                  value={settings.priceLineColor}
                  onChange={(v) => onChange({ priceLineColor: v })}
                />
              )}
            </div>
          )}

          {tab === "Achsen" && (
            <div className="divide-y divide-brand-border/60">
              <ToggleField
                label="Auto-Skalierung"
                checked={settings.autoScale}
                onChange={(v) => onChange({ autoScale: v })}
              />
              <ToggleField
                label="Prozent-Skala"
                checked={settings.percentScale}
                onChange={(v) => onChange({ percentScale: v, logScale: v ? false : settings.logScale })}
              />
              <ToggleField
                label="Log-Skalierung"
                checked={settings.logScale}
                onChange={(v) => onChange({ logScale: v, percentScale: v ? false : settings.percentScale })}
              />
              <p className="pt-2 text-[11px] text-foreground/40">
                Prozent- und Log-Skalierung schließen sich gegenseitig aus.
              </p>
            </div>
          )}

          {tab === "Hintergrund" && (
            <div className="divide-y divide-brand-border/60">
              <ToggleField
                label="Grid-Linien anzeigen"
                checked={settings.gridVisible}
                onChange={(v) => onChange({ gridVisible: v })}
              />
              {settings.gridVisible && (
                <ColorField
                  label="Farbe Grid-Linien"
                  value={settings.gridColor}
                  onChange={(v) => onChange({ gridColor: v, gridColorCustomized: true })}
                />
              )}
              <ToggleField
                label="Wasserzeichen anzeigen"
                checked={settings.watermarkVisible}
                onChange={(v) => onChange({ watermarkVisible: v })}
              />
            </div>
          )}

          {tab === "Zeitzone" && (
            <div className="space-y-2">
              <p className="text-xs text-foreground/50">
                Wirkt sich auf die angezeigte Zeitachse und die Fadenkreuz-Beschriftung aus.
              </p>
              <select
                value={settings.timezone}
                onChange={(e) => onChange({ timezone: e.target.value })}
                className="w-full rounded-lg border border-brand-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-brand-teal"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-brand-border px-4 py-3">
          <button type="button" onClick={onReset} className="text-xs font-medium text-foreground/50 hover:text-foreground">
            Standardeinstellungen
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-brand-teal px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-teal/90"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
