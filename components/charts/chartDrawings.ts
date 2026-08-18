export interface HorizontalLineDrawing {
  id: string;
  type: "horizontal-line";
  price: number;
  color: string;
}

export interface TrendLineDrawing {
  id: string;
  type: "trend-line";
  pointA: { time: number; price: number };
  pointB: { time: number; price: number };
  color: string;
}

export type Drawing = HorizontalLineDrawing | TrendLineDrawing;

const STORAGE_PREFIX = "finara-chart-drawings:";

export function drawingsStorageKey(symbol: string): string {
  return `${STORAGE_PREFIX}${symbol.toUpperCase()}`;
}

// Drawings are keyed per symbol (unlike indicators/chart-type, which are global display
// preferences) — a horizontal line at a given price or a trend line anchored to specific
// (time, price) coordinates is meaningless, or actively misleading, on a different instrument.
export function loadDrawings(symbol: string): Drawing[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(drawingsStorageKey(symbol));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDrawings(symbol: string, drawings: Drawing[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(drawingsStorageKey(symbol), JSON.stringify(drawings));
  } catch {
    // best-effort — ignore quota/availability errors
  }
}

export function makeDrawingId(): string {
  return `drw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
