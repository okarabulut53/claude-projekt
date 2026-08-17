import { ReactNode } from "react";
import { ChartLineIcon, CoinsIcon } from "@/components/icons/Icons";

export function HeroVisual({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-14 rounded-[62%_38%_35%_65%/58%_32%_68%_42%] bg-brand-teal/25"
      />

      <div className="absolute -top-6 -right-5 z-20 flex items-center gap-2.5 rounded-2xl border border-brand-border bg-white px-3.5 py-2.5 shadow-md">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-risk-low-bg text-risk-low">
          <ChartLineIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] leading-none text-foreground/50">30 Tage</div>
          <div className="text-sm font-bold leading-tight text-risk-low">+12,4 %</div>
        </div>
      </div>

      <div className="relative z-10">{children}</div>

      <div className="absolute -bottom-6 left-6 z-20 flex translate-y-full items-center gap-2.5 rounded-2xl border border-brand-border bg-white px-3.5 py-2.5 shadow-md">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal-light text-brand-teal">
          <CoinsIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] leading-none text-foreground/50">Abgedeckt</div>
          <div className="text-sm font-bold leading-tight text-brand-navy">Aktien · ETFs · Krypto</div>
        </div>
      </div>
    </div>
  );
}
