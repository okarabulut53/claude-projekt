"use client";

import { useEffect, useState } from "react";

export interface ChatLayoutState {
  threadSidebarWidth: number;
  threadSidebarCollapsed: boolean;
  chatWidth: number;
  chatCollapsed: boolean;
  chartCollapsed: boolean;
  watchlistWidth: number;
  watchlistCollapsed: boolean;
}

const STORAGE_KEY = "finara-chat-layout";

export const CHAT_LAYOUT_DEFAULTS: ChatLayoutState = {
  threadSidebarWidth: 288, // matches the old fixed w-72
  threadSidebarCollapsed: false,
  chatWidth: 384, // matches the old fixed max-w-sm
  chatCollapsed: false,
  chartCollapsed: false,
  watchlistWidth: 288, // matches the old fixed w-72
  watchlistCollapsed: false,
};

function loadChatLayout(): ChatLayoutState {
  if (typeof window === "undefined") return CHAT_LAYOUT_DEFAULTS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return CHAT_LAYOUT_DEFAULTS;
    return { ...CHAT_LAYOUT_DEFAULTS, ...JSON.parse(stored) };
  } catch {
    return CHAT_LAYOUT_DEFAULTS;
  }
}

function saveChatLayout(state: ChatLayoutState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best-effort — ignore quota/availability errors
  }
}

/** Single shared persisted layout for the FinaraAI page's resizable/collapsible columns —
 *  one hook instance in ChatShell rather than one per panel, so all three widths + two
 *  collapsed flags read/write the same localStorage blob without racing each other. */
export function useChatLayout() {
  const [layout, setLayout] = useState<ChatLayoutState>(CHAT_LAYOUT_DEFAULTS);

  useEffect(() => {
    Promise.resolve().then(() => setLayout(loadChatLayout()));
  }, []);

  function update(patch: Partial<ChatLayoutState>) {
    setLayout((prev) => {
      const next = { ...prev, ...patch };
      saveChatLayout(next);
      return next;
    });
  }

  // Separate from update() because a drag calls this many times per second, each with only the
  // incremental pointer delta since the last event — it must add onto the CURRENT width via
  // React's functional setState form (prev), not a value captured in the caller's closure at
  // drag-start, or fast drags would repeatedly overwrite instead of accumulating.
  function resizeWidth(key: "threadSidebarWidth" | "chatWidth" | "watchlistWidth", deltaPx: number, min: number, max: number) {
    setLayout((prev) => {
      const next = { ...prev, [key]: Math.min(max, Math.max(min, prev[key] + deltaPx)) };
      saveChatLayout(next);
      return next;
    });
  }

  return { layout, update, resizeWidth };
}
