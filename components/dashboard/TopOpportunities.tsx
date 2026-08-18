"use client";

import { useMemo, useState } from "react";
import { InvestmentOpportunity, RiskProfile } from "@/lib/types";
import { OpportunityCard } from "@/components/opportunities/OpportunityCard";

type Tab = "top10" | RiskProfile;

const tabs: { value: Tab; label: string }[] = [
  { value: "top10", label: "Top 10" },
  { value: "low", label: "Niedrig" },
  { value: "medium", label: "Mittel" },
  { value: "high", label: "Hoch" },
];

export function TopOpportunities({ opportunities }: { opportunities: InvestmentOpportunity[] }) {
  const [tab, setTab] = useState<Tab>("top10");

  const sorted = useMemo(() => [...opportunities].sort((a, b) => b.aiScore - a.aiScore), [opportunities]);

  const visible = useMemo(() => {
    if (tab === "top10") return sorted.slice(0, 10);
    return sorted.filter((o) => o.riskLevel === tab);
  }, [sorted, tab]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-foreground">Top KI-Empfehlungen</h2>
        <div className="flex items-center gap-1 rounded-full bg-brand-surface p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                tab === t.value ? "bg-surface text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((opportunity, index) => (
          <div key={opportunity.id} className="relative">
            {tab === "top10" && (
              <span className="absolute -left-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white shadow-sm">
                {index + 1}
              </span>
            )}
            <OpportunityCard opportunity={opportunity} />
          </div>
        ))}
      </div>
    </div>
  );
}
