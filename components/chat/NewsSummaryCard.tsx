import { BellIcon } from "@/components/icons/Icons";
import { parseStructuredMessage } from "./structuredMessage";

export interface NewsSummaryItem {
  title: string;
  source: string;
  publishedAt: string;
  relevance: string;
}

export interface NewsSummary {
  type: "news_summary";
  scope: string;
  items: NewsSummaryItem[];
}

export function parseNewsSummary(content: string): NewsSummary | null {
  const parsed = parseStructuredMessage(content) as Partial<NewsSummary> | null;
  if (parsed && parsed.type === "news_summary" && Array.isArray(parsed.items)) {
    return parsed as NewsSummary;
  }
  return null;
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function NewsSummaryCard({ summary }: { summary: NewsSummary }) {
  return (
    <div className="max-w-[90%] rounded-2xl border border-brand-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
          <BellIcon className="h-3.5 w-3.5" />
        </span>
        {summary.scope}
      </div>

      <div className="space-y-2">
        {summary.items.map((item, i) => (
          <div key={i} className="rounded-lg bg-brand-surface p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{item.title}</span>
              <span className="shrink-0 text-[10px] text-foreground/40">{formatTime(item.publishedAt)}</span>
            </div>
            <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/40">{item.source}</div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/70">{item.relevance}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
