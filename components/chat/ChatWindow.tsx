"use client";

import { FormEvent, useState } from "react";
import { sendChatMessage } from "@/lib/actions/chat";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const suggestions = [
  "Wie hoch ist mein Guthaben?",
  "Welche Positionen sollte ich behalten?",
  "Was ist ein ETF?",
];

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Hallo! Frag mich nach deinem Portfolio, einzelnen Instrumenten oder allgemeinen Finanzthemen. Ich gebe dir Einschätzungen mit Begründung — keine Kauf- oder Verkaufsanweisungen.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChatMessage(text);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Entschuldigung, dabei ist ein Fehler aufgetreten." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <div className="flex h-[65vh] flex-col overflow-hidden rounded-2xl border border-brand-border bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-brand-navy text-white"
                  : "bg-brand-surface text-foreground"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-brand-surface px-4 py-2.5 text-sm text-foreground/50">
              Tippt…
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-brand-border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-brand-border px-3 py-1 text-xs text-foreground/60 hover:border-brand-teal hover:text-brand-navy"
            >
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Deine Frage…"
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
      </div>
    </div>
  );
}
