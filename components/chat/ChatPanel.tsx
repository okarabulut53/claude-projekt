"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { sendChatMessage } from "@/lib/actions/chat";
import { getThreadHistory } from "@/lib/actions/chat-threads";
import { ChatMessage, Instrument } from "@/lib/types";
import { renderChartImage } from "@/lib/chart-image";
import { DisclaimerNote } from "@/components/ui/DisclaimerNote";
import { ChatBubbleIcon } from "@/components/icons/Icons";
import { MarketAnalysisCard, parseMarketAnalysis } from "@/components/chat/MarketAnalysisCard";

const categoryChips = [
  { label: "Aktienauswahl & -analyse", prompt: "Wie sieht NVIDIA aktuell aus?" },
  { label: "Markttrends", prompt: "Was sind aktuell interessante Investment Opportunities?" },
  { label: "Watchlist-Einblicke", prompt: "Gibt es Neuigkeiten zu meiner Watchlist?" },
  { label: "Portfolio-Check", prompt: "Wie hoch ist mein Guthaben?" },
  { label: "Glossar", prompt: "Was ist ein ETF?" },
];

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
  const bottomRef = useRef<HTMLDivElement>(null);

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
    setLoading(true);
    try {
      const chartImage = chartInstrument
        ? renderChartImage(chartInstrument.history, chartInstrument.changePercent1d >= 0)
        : null;
      const chartAttachment = chartImage ? { ...chartImage, symbol: chartInstrument!.symbol } : null;
      const { reply, threadId: resolvedThreadId } = await sendChatMessage(text, threadId, chartAttachment);
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-r`, threadId: resolvedThreadId, role: "assistant", content: reply, createdAt: new Date().toISOString() },
      ]);
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
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {categoryChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => send(chip.prompt)}
                  className="rounded-full border border-brand-border px-2.5 py-1 text-[11px] font-medium text-foreground/70 hover:border-brand-teal hover:text-foreground"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-4 py-4">
            {loadingHistory && <p className="text-sm text-foreground/40">Lade Chatverlauf…</p>}
            {messages.map((message) => {
              const analysis = message.role === "assistant" ? parseMarketAnalysis(message.content) : null;
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
                    {analysis ? (
                      <MarketAnalysisCard analysis={analysis} />
                    ) : (
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          message.role === "user" ? "bg-brand-navy text-white" : "bg-brand-surface text-foreground"
                        }`}
                      >
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-brand-surface px-4 py-2.5 text-sm text-foreground/50">Tippt…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-brand-border p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
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
