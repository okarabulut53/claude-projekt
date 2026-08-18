export interface ChartSettings {
  upColor: string;
  downColor: string;
  priceLineVisible: boolean;
  priceLineColor: string;
  autoScale: boolean;
  percentScale: boolean;
  logScale: boolean;
  gridVisible: boolean;
  gridColor: string;
  /** True once the user has explicitly picked a grid color — gates whether a light/dark theme
   *  switch is allowed to auto-update gridColor to the new theme's default. */
  gridColorCustomized: boolean;
  watermarkVisible: boolean;
  timezone: string;
}

export const TIMEZONES: { id: string; label: string }[] = [
  { id: "UTC", label: "UTC" },
  { id: "Europe/Berlin", label: "Europe/Berlin (MEZ/MESZ)" },
  { id: "Europe/London", label: "Europe/London" },
  { id: "America/New_York", label: "America/New York" },
  { id: "America/Los_Angeles", label: "America/Los Angeles" },
  { id: "Asia/Tokyo", label: "Asia/Tokyo" },
  { id: "Asia/Shanghai", label: "Asia/Shanghai" },
  { id: "Australia/Sydney", label: "Australia/Sydney" },
];

export function defaultChartSettings(colors: { up: string; down: string; grid: string }): ChartSettings {
  return {
    upColor: colors.up,
    downColor: colors.down,
    priceLineVisible: true,
    priceLineColor: colors.up,
    autoScale: true,
    percentScale: false,
    logScale: false,
    gridVisible: true,
    gridColor: colors.grid,
    gridColorCustomized: false,
    watermarkVisible: false,
    timezone: "Europe/Berlin",
  };
}

const STORAGE_KEY = "finara-chart-settings";

export function loadStoredChartSettings(): Partial<ChartSettings> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function saveChartSettings(settings: ChartSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort — ignore quota/availability errors
  }
}
