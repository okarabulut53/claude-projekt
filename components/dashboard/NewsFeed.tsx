import { NewsItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/format";

export function NewsFeed({
  news,
  relevantSymbols = [],
}: {
  news: NewsItem[];
  relevantSymbols?: string[];
}) {
  const sorted = [...news].sort((a, b) => {
    const aRelevant = a.relatedSymbols.some((s) => relevantSymbols.includes(s));
    const bRelevant = b.relatedSymbols.some((s) => relevantSymbols.includes(s));
    if (aRelevant !== bRelevant) return aRelevant ? -1 : 1;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-navy">News-Feed</h2>
        {relevantSymbols.length > 0 && (
          <span className="text-xs text-foreground/50">Sortiert nach Portfolio-Relevanz</span>
        )}
      </div>
      <ul className="mt-4 space-y-4">
        {sorted.map((item) => {
          const isRelevant = item.relatedSymbols.some((s) => relevantSymbols.includes(s));
          return (
            <li key={item.id} className="border-b border-brand-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <span className="font-medium">{item.source}</span>
                <span>·</span>
                <span>{formatRelativeTime(item.publishedAt)}</span>
                {isRelevant && (
                  <span className="rounded-full bg-brand-teal-light px-2 py-0.5 text-[11px] font-semibold text-brand-teal">
                    In deinem Portfolio
                  </span>
                )}
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-sm font-semibold text-brand-navy hover:underline"
                >
                  {item.title}
                </a>
              ) : (
                <h3 className="mt-1 text-sm font-semibold text-brand-navy">{item.title}</h3>
              )}
              {item.summary && (
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">{item.summary}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.relatedSymbols.map((symbol) => (
                  <span
                    key={symbol}
                    className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-foreground/60"
                  >
                    {symbol}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
