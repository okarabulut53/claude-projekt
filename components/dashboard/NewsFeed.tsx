import { NewsItem } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/format";

export function NewsFeed({ news }: { news: NewsItem[] }) {
  return (
    <Card>
      <h2 className="text-base font-semibold text-brand-navy">News-Feed</h2>
      <ul className="mt-4 space-y-4">
        {news.map((item) => (
          <li key={item.id} className="border-b border-brand-border pb-4 last:border-0 last:pb-0">
            <div className="flex items-center gap-2 text-xs text-foreground/50">
              <span className="font-medium">{item.source}</span>
              <span>·</span>
              <span>{formatRelativeTime(item.publishedAt)}</span>
            </div>
            <h3 className="mt-1 text-sm font-semibold text-brand-navy">{item.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-foreground/70">{item.summary}</p>
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
        ))}
      </ul>
    </Card>
  );
}
