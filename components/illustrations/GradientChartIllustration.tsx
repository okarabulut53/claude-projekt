const points: [number, number][] = [
  [30, 210],
  [90, 175],
  [140, 205],
  [195, 115],
  [250, 145],
  [290, 70],
];

const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
const areaPath = `${linePath} L ${points[points.length - 1][0]} 260 L ${points[0][0]} 260 Z`;

export function GradientChartIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="absolute inset-4 rounded-[55%_45%_40%_60%/55%_35%_65%_45%] bg-gradient-to-br from-violet-100 via-fuchsia-50 to-orange-100"
      />

      <svg viewBox="0 0 320 280" className="relative w-full">
        <defs>
          <linearGradient id="gci-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="gci-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#gci-fill)" stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="url(#gci-stroke)"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={6} fill="white" stroke="url(#gci-stroke)" strokeWidth={3.5} />
        ))}
      </svg>

      <div className="relative mx-auto -mt-6 w-fit rounded-2xl border border-brand-border bg-white px-4 py-2.5 shadow-md">
        <div className="text-[10px] leading-none text-foreground/50">AI Score Trend, 7 Tage</div>
        <div className="mt-1 text-sm font-bold text-brand-navy">Ø 78/100 · steigende Tendenz</div>
      </div>
    </div>
  );
}
