"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatFolder, ChatThread, Instrument, WatchlistItem } from "@/lib/types";
import {
  createFolder,
  listChatThreads,
  moveThreadDownAction,
  moveThreadToFolder,
  removeChatFolder,
  removeChatThread,
  renameThread,
  setThreadPinnedState,
  setThreadUnreadState,
} from "@/lib/actions/chat-threads";
import { ChatThreadSidebar } from "@/components/chat/ChatThreadSidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ChatChartPanel } from "@/components/chat/ChatChartPanel";
import { ChatWatchlistPanel } from "@/components/chat/ChatWatchlistPanel";
import { ResizeHandle } from "@/components/chat/ResizeHandle";
import { useChatLayout } from "@/components/chat/useChatLayout";
import { ChevronLeftIcon } from "@/components/icons/Icons";
import { cn } from "@/lib/cn";

const COLLAPSED_WIDTH = 40;

// Always visible (no hover-to-reveal — that made these effectively invisible on a 6px divider).
// Direction is a fixed, panel-position-independent convention: pointing left always means
// "ausblenden" (hide), pointing right always means "einblenden" (show) — not mirrored per side.
function CollapseButton({ collapsed, onClick, label }: {
  collapsed: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-5 items-center justify-center rounded-full border border-brand-border bg-surface text-foreground/60 shadow-sm transition-colors hover:border-brand-teal hover:bg-brand-teal-light hover:text-brand-teal"
    >
      <ChevronLeftIcon className={cn("h-3.5 w-3.5", collapsed && "rotate-180")} />
    </button>
  );
}

export function ChatShell({
  initialThreads,
  initialFolders,
  watchlist,
}: {
  initialThreads: ChatThread[];
  initialFolders: ChatFolder[];
  watchlist: WatchlistItem[];
}) {
  const searchParams = useSearchParams();
  const [threads, setThreads] = useState(initialThreads);
  const [folders, setFolders] = useState(initialFolders);
  // Supports "In neuem Tab öffnen" from the chat context menu (/finaraai?thread=<id>) — falls
  // back to the most recent thread when there's no ?thread= param or it doesn't match a thread
  // this user actually has.
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    const requested = searchParams.get("thread");
    if (requested && initialThreads.some((t) => t.id === requested)) return requested;
    return initialThreads[0]?.id ?? null;
  });
  const [chartSymbol, setChartSymbol] = useState<string | null>(watchlist[0]?.symbol ?? "SAP");
  const [chartInstrument, setChartInstrument] = useState<Instrument | null>(null);
  const { layout, update, resizeWidth } = useChatLayout();

  async function refreshThreads() {
    const fresh = await listChatThreads();
    setThreads(fresh);
  }

  function handleThreadUpdate(threadId: string, isNew: boolean) {
    setActiveThreadId(threadId);
    if (isNew) {
      refreshThreads();
    } else {
      setThreads((prev) => {
        const rest = prev.filter((t) => t.id !== threadId);
        const existing = prev.find((t) => t.id === threadId);
        return existing ? [{ ...existing, updatedAt: new Date().toISOString() }, ...rest] : prev;
      });
    }
  }

  async function handleCreateFolder(name: string) {
    const folder = await createFolder(name);
    setFolders((prev) => [...prev, folder]);
  }

  async function handleMoveThread(threadId: string, folderId: string | null) {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, folderId } : t)));
    await moveThreadToFolder(threadId, folderId);
  }

  async function handleDeleteThread(threadId: string) {
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (activeThreadId === threadId) setActiveThreadId(null);
    await removeChatThread(threadId);
  }

  async function handleDeleteFolder(folderId: string) {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    // Mirrors the DB's on-delete-set-null behavior (supabase/schema.sql): threads move back to
    // "kein Ordner" instead of being deleted along with the folder.
    setThreads((prev) => prev.map((t) => (t.folderId === folderId ? { ...t, folderId: null } : t)));
    await removeChatFolder(folderId);
  }

  function handleSelectThreadFromSidebar(threadId: string) {
    setActiveThreadId(threadId);
    const thread = threads.find((t) => t.id === threadId);
    if (thread?.unread) {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t)));
      setThreadUnreadState(threadId, false);
    }
  }

  async function handleTogglePin(threadId: string) {
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) return;
    const nextPinned = !thread.pinned;
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, pinned: nextPinned } : t)));
    await setThreadPinnedState(threadId, nextPinned);
  }

  async function handleMarkUnread(threadId: string) {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread: true } : t)));
    await setThreadUnreadState(threadId, true);
  }

  async function handleRenameThread(threadId: string, title: string) {
    setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title } : t)));
    await renameThread(threadId, title);
  }

  // sortOrder swaps happen server-side (lib/db.ts's moveThreadDown reads both neighbors' current
  // values) — a client-side optimistic guess would need to know the neighbor's sortOrder too, so
  // this just re-fetches the authoritative order instead.
  async function handleMoveThreadDown(threadId: string) {
    await moveThreadDownAction(threadId);
    await refreshThreads();
  }

  async function handleCreateFolderAndMoveThread(threadId: string, name: string) {
    const folder = await createFolder(name);
    setFolders((prev) => [...prev, folder]);
    await handleMoveThread(threadId, folder.id);
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <ChatThreadSidebar
        threads={threads}
        folders={folders}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThreadFromSidebar}
        onNewChat={() => setActiveThreadId(null)}
        onCreateFolder={handleCreateFolder}
        onMoveThread={handleMoveThread}
        onDeleteThread={handleDeleteThread}
        onDeleteFolder={handleDeleteFolder}
        onTogglePin={handleTogglePin}
        onMarkUnread={handleMarkUnread}
        onRenameThread={handleRenameThread}
        onMoveThreadDown={handleMoveThreadDown}
        onCreateFolderAndMoveThread={handleCreateFolderAndMoveThread}
        width={layout.threadSidebarWidth}
        collapsed={layout.threadSidebarCollapsed}
        onExpand={() => update({ threadSidebarCollapsed: false })}
      />
      <ResizeHandle
        disabled={layout.threadSidebarCollapsed}
        onResize={(delta) => resizeWidth("threadSidebarWidth", delta, 200, 480)}
        collapseButtons={[
          <CollapseButton
            key="sidebar"
            collapsed={layout.threadSidebarCollapsed}
            onClick={() => update({ threadSidebarCollapsed: !layout.threadSidebarCollapsed })}
            label={layout.threadSidebarCollapsed ? "Chat-Liste einblenden" : "Chat-Liste ausblenden"}
          />,
          <CollapseButton
            key="chat"
            collapsed={layout.chatCollapsed}
            onClick={() => update({ chatCollapsed: !layout.chatCollapsed })}
            label={layout.chatCollapsed ? "Chatbot einblenden" : "Chatbot ausblenden"}
          />,
        ]}
      />

      <div
        className="flex shrink-0 flex-col overflow-hidden border-r border-brand-border bg-surface"
        style={layout.chatCollapsed ? { flex: `0 0 ${COLLAPSED_WIDTH}px` } : { flex: `0 0 ${layout.chatWidth}px` }}
      >
        {/* Stays mounted at all times (only its column width changes) so the active thread,
            draft input, and scroll position survive a collapse/expand cycle. */}
        <div className={cn("h-full min-h-0", layout.chatCollapsed && "invisible")}>
          <ChatPanel threadId={activeThreadId} onThreadUpdate={handleThreadUpdate} chartInstrument={chartInstrument} />
        </div>
      </div>
      <ResizeHandle
        disabled={layout.chatCollapsed || layout.chartCollapsed}
        onResize={(delta) => resizeWidth("chatWidth", delta, 280, 640)}
        collapseButtons={[
          <CollapseButton
            key="chart"
            collapsed={layout.chartCollapsed}
            onClick={() => update({ chartCollapsed: !layout.chartCollapsed })}
            label={layout.chartCollapsed ? "Chart einblenden" : "Chart ausblenden"}
          />,
        ]}
      />

      <div
        className="flex min-h-0 flex-col overflow-hidden bg-surface"
        style={layout.chartCollapsed ? { flex: `0 0 ${COLLAPSED_WIDTH}px` } : { flex: "1 1 0%" }}
      >
        {/* Chart panel stays mounted at all times (only its column width changes) so its symbol,
            drawings, and indicators survive a collapse/expand cycle instead of resetting. */}
        <div className={cn("h-full min-h-0", layout.chartCollapsed && "invisible")}>
          <ChatChartPanel symbol={chartSymbol} onSymbolChange={setChartSymbol} onInstrumentChange={setChartInstrument} />
        </div>
      </div>
      <ResizeHandle
        disabled={layout.chartCollapsed || layout.watchlistCollapsed}
        onResize={(delta) => resizeWidth("watchlistWidth", -delta, 200, 480)}
        collapseButtons={[
          <CollapseButton
            key="watchlist"
            collapsed={layout.watchlistCollapsed}
            onClick={() => update({ watchlistCollapsed: !layout.watchlistCollapsed })}
            label={layout.watchlistCollapsed ? "Watchlist einblenden" : "Watchlist ausblenden"}
          />,
        ]}
      />

      <div
        className="hidden shrink-0 flex-col overflow-hidden border-l border-brand-border bg-surface lg:flex"
        style={layout.watchlistCollapsed ? { flex: `0 0 ${COLLAPSED_WIDTH}px` } : { flex: `0 0 ${layout.watchlistWidth}px` }}
      >
        {/* Stays mounted at all times so scroll position/state survive a collapse/expand cycle. */}
        <div className={cn("h-full min-h-0", layout.watchlistCollapsed && "invisible")}>
          <ChatWatchlistPanel
            items={watchlist}
            onSelectSymbol={(symbol) => {
              setChartSymbol(symbol);
              if (layout.chartCollapsed) update({ chartCollapsed: false });
            }}
          />
        </div>
      </div>
    </div>
  );
}
