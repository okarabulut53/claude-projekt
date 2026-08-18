import { PricePoint } from "@/lib/types";

export interface ChartImage {
  base64: string;
  mediaType: "image/png";
}

/**
 * Rasterizes a price history to a PNG so it can be sent to Claude's vision API.
 * Canvas-only (no charting dependency), mirrors LineChart.tsx's SVG rendering logic.
 */
export function renderChartImage(history: PricePoint[], positive: boolean): ChartImage | null {
  if (typeof document === "undefined" || history.length < 2) return null;

  const width = 800;
  const height = 400;
  const padding = 24;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const coords = history.map((p, i) => ({
    x: padding + (i / (history.length - 1)) * (width - padding * 2),
    y: padding + (height - padding * 2) * (1 - (p.price - min) / range),
  }));

  const color = positive ? "#16a34a" : "#dc2626";

  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.lineTo(coords[coords.length - 1].x, height - padding);
  ctx.lineTo(coords[0].x, height - padding);
  ctx.closePath();
  ctx.fillStyle = positive ? "rgba(22, 163, 74, 0.12)" : "rgba(220, 38, 38, 0.12)";
  ctx.fill();

  ctx.beginPath();
  coords.forEach((c, i) => (i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1];
  if (!base64) return null;
  return { base64, mediaType: "image/png" };
}
