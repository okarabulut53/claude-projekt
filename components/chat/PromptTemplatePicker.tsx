"use client";

import { useState } from "react";
import { promptCategories, PromptTemplate } from "@/lib/finara-ai/promptTemplates";
import { ChevronLeftIcon } from "@/components/icons/Icons";

function fillTemplate(template: PromptTemplate, tickers: string[]) {
  let text = template.prompt;
  if (template.prompt.includes("{ticker1}") || template.prompt.includes("{ticker2}")) {
    text = text.replace("{ticker1}", tickers[0]?.toUpperCase() ?? "").replace("{ticker2}", tickers[1]?.toUpperCase() ?? "");
  } else if (template.prompt.includes("{ticker}")) {
    text = text.replace("{ticker}", tickers[0]?.toUpperCase() ?? "");
  }
  return text;
}

export function PromptTemplatePicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | null>(null);
  const [ticker1, setTicker1] = useState("");
  const [ticker2, setTicker2] = useState("");

  const category = promptCategories.find((c) => c.id === categoryId) ?? null;
  const needsTwoTickers = pendingTemplate?.prompt.includes("{ticker1}") ?? false;

  function reset() {
    setPendingTemplate(null);
    setTicker1("");
    setTicker2("");
  }

  function handleTemplateClick(template: PromptTemplate) {
    if (template.prompt.includes("{ticker}") || template.prompt.includes("{ticker1}")) {
      setPendingTemplate(template);
      return;
    }
    onInsert(template.prompt);
  }

  function handleTickerConfirm() {
    if (!pendingTemplate) return;
    if (!ticker1.trim() || (needsTwoTickers && !ticker2.trim())) return;
    onInsert(fillTemplate(pendingTemplate, [ticker1, ticker2]));
    reset();
  }

  if (pendingTemplate) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-3">
        <p className="mb-2 text-xs font-medium text-foreground/70">
          {needsTwoTickers ? "Für welche Instrumente?" : "Für welches Instrument?"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={ticker1}
            onChange={(e) => setTicker1(e.target.value)}
            placeholder={needsTwoTickers ? "z. B. NVDA" : "z. B. NVDA oder SAP"}
            className="w-32 rounded-full border border-brand-border px-3 py-1.5 text-xs outline-none focus:border-brand-teal"
            autoFocus
          />
          {needsTwoTickers && (
            <input
              value={ticker2}
              onChange={(e) => setTicker2(e.target.value)}
              placeholder="z. B. SAP"
              className="w-32 rounded-full border border-brand-border px-3 py-1.5 text-xs outline-none focus:border-brand-teal"
            />
          )}
          <button
            type="button"
            onClick={handleTickerConfirm}
            disabled={!ticker1.trim() || (needsTwoTickers && !ticker2.trim())}
            className="rounded-full bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-teal/90 disabled:opacity-50"
          >
            Einfügen
          </button>
          <button type="button" onClick={reset} className="text-xs text-foreground/50 hover:text-foreground">
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  if (category) {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-3">
        <button
          type="button"
          onClick={() => setCategoryId(null)}
          className="mb-2 flex items-center gap-1 text-xs font-medium text-foreground/60 hover:text-foreground"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          {category.label}
        </button>
        <div className="flex flex-wrap gap-1.5">
          {category.templates.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => handleTemplateClick(template)}
              title={template.unavailableReason}
              className={
                template.unavailableReason
                  ? "rounded-full border border-dashed border-brand-border px-2.5 py-1 text-[11px] font-medium text-foreground/40 hover:border-foreground/40 hover:text-foreground/60"
                  : "rounded-full border border-brand-border px-2.5 py-1 text-[11px] font-medium text-foreground/70 hover:border-brand-teal hover:text-foreground"
              }
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {promptCategories.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => setCategoryId(c.id)}
          className="rounded-full border border-brand-border px-2.5 py-1 text-[11px] font-medium text-foreground/70 hover:border-brand-teal hover:text-foreground"
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
