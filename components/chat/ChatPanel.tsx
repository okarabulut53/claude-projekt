"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "@/lib/actions/chat";
import { getThreadHistory } from "@/lib/actions/chat-threads";
import { ChatMessage, Instrument } from "@/lib/types";
import { renderChartImage } from "@/lib/chart-image";
import { isChartContextRelevant } from "@/lib/chat/chartRelevance";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { ChatBubbleIcon } from "@/components/icons/Icons";
import { MarketAnalysisCard, parseMarketAnalysis } from "@/components/chat/MarketAnalysisCard";
import { ScoreAnalysisCard, parseScoreAnalysis } from "@/components/chat/ScoreAnalysisCard";
import { RankingCard, parseRanking } from "@/components/chat/RankingCard";
import { SwotAnalysisCard, parseSwotAnalysis } from "@/components/chat/SwotAnalysisCard";
import { BullBearAnalysisCard, parseBullBearAnalysis } from "@/components/chat/BullBearAnalysisCard";
import { MarketOverviewCard, parseMarketOverview } from "@/components/chat/MarketOverviewCard";
import { NewsSummaryCard, parseNewsSummary } from "@/components/chat/NewsSummaryCard";
import { WatchlistOverviewCard, parseWatchlistOverview } from "@/components/chat/WatchlistOverviewCard";
import { FundamentalsCard, parseFundamentalsAnalysis } from "@/components/chat/FundamentalsCard";
import { ExportReadyCard, parseExportReady } from "@/components/chat/ExportReadyCard";
import { ShortTermComparisonCard, parseShortTermComparison } from "@/components/chat/ShortTermComparisonCard";
import { DaytradingScreenerCard, parseDaytradingScreener } from "@/components/chat/DaytradingScreenerCard";
import { StockReportCard, parseStockReport } from "@/components/chat/StockReportCard";
import { parseSuggestedFollowUp } from "@/components/chat/structuredMessage";
import { PromptTemplatePicker } from "@/components/chat/PromptTemplatePicker";
import { ChevronDownIcon, LayoutGridIcon } from "@/components/icons/Icons";

/** Cycling generic progress label shown while waiting for a reply — the real per-turn steps
 *  (tool calls actually made) are only known once the reply lands, so this is purely decorative
 *  (see StepsDropdown below for the real, post-completion steps). */
const LOADING_LABELS = ["Denkt nach…", "Daten werden abgerufen…", "Analyse wird vorbereitet…", "Fast fertig…"];

/** Session-only, collapsed-by-default list of the real tool-call steps taken for one assistant
 *  reply. Not persisted (steps aren't part of ChatMessage/the DB schema) — a reload of the thread
 *  loses them, by product decision (real steps shown after completion, no live streaming, no
 *  DB persistence). */
function StepsDropdown({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-foreground/40 hover:text-foreground/70"
      >
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Schritte ausblenden" : `Schritte anzeigen (${steps.length})`}
      </button>
      {open && (
        <ol className="mt-1.5 space-y-1 border-l border-brand-border pl-3 text-xs text-foreground/50">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Tries each present_*-tool's parser in order and renders the matching card — every structured
 *  chat reply funnels through here instead of a chain of if/else per type at the call site. */
function renderStructuredChatContent(content: string) {
  const marketAnalysis = parseMarketAnalysis(content);
  if (marketAnalysis) return <MarketAnalysisCard analysis={marketAnalysis} />;

  const scoreAnalysis = parseScoreAnalysis(content);
  if (scoreAnalysis) return <ScoreAnalysisCard analysis={scoreAnalysis} />;

  const ranking = parseRanking(content);
  if (ranking) return <RankingCard ranking={ranking} />;

  const swot = parseSwotAnalysis(content);
  if (swot) return <SwotAnalysisCard analysis={swot} />;

  const bullBear = parseBullBearAnalysis(content);
  if (bullBear) return <BullBearAnalysisCard analysis={bullBear} />;

  const marketOverview = parseMarketOverview(content);
  if (marketOverview) return <MarketOverviewCard overview={marketOverview} />;

  const newsSummary = parseNewsSummary(content);
  if (newsSummary) return <NewsSummaryCard summary={newsSummary} />;

  const watchlistOverview = parseWatchlistOverview(content);
  if (watchlistOverview) return <WatchlistOverviewCard overview={watchlistOverview} />;

  const fundamentalsAnalysis = parseFundamentalsAnalysis(content);
  if (fundamentalsAnalysis) return <FundamentalsCard analysis={fundamentalsAnalysis} />;

  const exportReady = parseExportReady(content);
  if (exportReady) return <ExportReadyCard file={exportReady} />;

  const shortTermComparison = parseShortTermComparison(content);
  if (shortTermComparison) return <ShortTermComparisonCard comparison={shortTermComparison} />;

  const daytradingScreener = parseDaytradingScreener(content);
  if (daytradingScreener) return <DaytradingScreenerCard screener={daytradingScreener} />;

  const stockReport = parseStockReport(content);
  if (stockReport) return <StockReportCard report={stockReport} />;

  return null;
}

export function ChatPanel({
  threadId,
  onThreadUpdate,
  chartInstrument,
}: {
  threadId: string | null;
  onThreadUpdate: (threadId: string, isNew: boolean) => void;
  chartInstrument: Instrument | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prevThreadId, setPrevThreadId] = useState(threadId);
  const [loadedThreadId, setLoadedThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabelIndex, setLoadingLabelIndex] = useState(0);
  const [stepsByMessageId, setStepsByMessageId] = useState<Record<string, string[]>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setLoadingLabelIndex((i) => (i + 1) % LOADING_LABELS.length), 1400);
    return () => clearInterval(interval);
  }, [loading]);

  function insertTemplate(text: string) {
    setInput(text);
    setShowTemplates(false);
  }

  if (threadId !== prevThreadId) {
    setPrevThreadId(threadId);
    if (threadId !== loadedThreadId) setMessages([]);
  }
  const loadingHistory = threadId !== null && loadedThreadId !== threadId;

  useEffect(() => {
    if (!threadId || threadId === loadedThreadId) return;
    let cancelled = false;
    getThreadHistory(threadId).then((history) => {
      if (!cancelled) {
        setMessages(history);
        setLoadedThreadId(threadId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, loadedThreadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const isNewThread = !threadId;
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, threadId: threadId ?? "", role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    setInput("");
    setLoadingLabelIndex(0);
    setLoading(true);
    try {
      const chartRelevant =
        chartInstrument !== null && isChartContextRelevant(text, chartInstrument.symbol, chartInstrument.name);
      const chartImage = chartRelevant
        ? renderChartImage(chartInstrument!.history, chartInstrument!.changePercent1d >= 0)
        : null;
      const chartAttachment = chartImage ? { ...chartImage, symbol: chartInstrument!.symbol } : null;
      const { reply, steps, threadId: resolvedThreadId } = await sendChatMessage(text, threadId, chartAttachment);
      // replyId is captured from inside the updater (rather than a separate `const` computed via
      // Date.now() beforehand) so the same id can be reused for the steps-lookup below without
      // tripping the react-hooks/purity lint rule on a bare impure call in the component body.
      let replyId = "";
      setMessages((prev) => {
        replyId = `local-${Date.now()}-r`;
        return [...prev, { id: replyId, threadId: resolvedThreadId, role: "assistant", content: reply, createdAt: new Date().toISOString() }];
      });
      if (steps.length > 0) {
        setStepsByMessageId((prev) => ({ ...prev, [replyId]: steps }));
      }
      setLoadedThreadId(resolvedThreadId);
      onThreadUpdate(resolvedThreadId, isNewThread);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-e`, threadId: threadId ?? "", role: "assistant", content: "Entschuldigung, dabei ist ein Fehler aufgetreten.", createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const showIntro = messages.length === 0 && !loadingHistory;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {showIntro ? (
          <div className="px-4 py-8 text-center">
            <div className="mb-3 flex items-center justify-center gap-2">
              <span className="text-xl font-bold text-foreground">Finara</span>
              <span className="rounded-full bg-brand-teal px-2 py-0.5 text-xs font-bold text-white">AI</span>
            </div>
            <p className="mb-6 text-xs text-foreground/60">
              FinaraAI nimmt dir die Analysearbeit ab, damit du schneller und smarter investierst.
            </p>
            <h1 className="mb-5 text-base font-bold text-foreground">
              Was darf&apos;s sein — Charts, Trends oder Börsenideen?
            </h1>
            <div className="mx-auto max-w-md text-left">
              <PromptTemplatePicker onInsert={insertTemplate} />
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {loadingHistory && <p className="text-sm text-foreground/40">Lade Chatverlauf…</p>}
            {messages.map((message) => {
              const structured = message.role === "assistant" ? renderStructuredChatContent(message.content) : null;
              const followUp = structured && message.role === "assistant" ? parseSuggestedFollowUp(message.content) : null;
              return (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex max-w-[80%] items-start gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    {message.role === "assistant" && (
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-brand-teal">
                        <ChatBubbleIcon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div className="min-w-0">
                      {structured ? (
                        structured
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                            message.role === "user" ? "bg-brand-navy text-white" : "bg-brand-surface text-foreground"
                          }`}
                        >
                          {message.content}
                        </div>
                      )}
                      {message.role === "assistant" && stepsByMessageId[message.id]?.length > 0 && (
                        <StepsDropdown steps={stepsByMessageId[message.id]} />
                      )}
                      {followUp && (
                        <button
                          type="button"
                          onClick={() => send(followUp)}
                          disabled={loading}
                          className="mt-2 rounded-full border border-brand-teal px-3 py-1.5 text-xs font-medium text-brand-teal hover:bg-brand-teal-light disabled:opacity-50"
                        >
                          {followUp}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-brand-surface px-4 py-2.5 text-sm text-foreground/50">
                  {LOADING_LABELS[loadingLabelIndex]}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-brand-border p-4">
        {showTemplates && (
          <div className="mb-3">
            <PromptTemplatePicker onInsert={insertTemplate} />
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            aria-label="Vorlagen"
            title="Vorlagen"
            className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border ${
              showTemplates ? "border-brand-teal text-brand-teal" : "border-brand-border text-foreground/60"
            } hover:border-brand-teal hover:text-brand-teal`}
          >
            <LayoutGridIcon className="h-4 w-4" />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stelle deine Frage…"
            className="flex-1 rounded-full border border-brand-border px-4 py-2.5 text-sm outline-none focus:border-brand-teal"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal/90 disabled:opacity-50"
          >
            Senden
          </button>
        </form>
        <DisclaimerNote className="mt-3 text-center" />
      </div>
    </div>
  );
}
