"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import { ChatFolder, ChatThread } from "@/lib/types";
import { FolderIcon, MoreHorizontalIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons/Icons";
import { ChatContextMenu } from "@/components/chat/ChatContextMenu";
import { cn } from "@/lib/cn";

function dayBucket(iso: string): "Heute" | "Gestern" | "Älter" {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays <= 0) return "Heute";
  if (diffDays === 1) return "Gestern";
  return "Älter";
}

export function ChatThreadSidebar({
  threads,
  folders,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onCreateFolder,
  onMoveThread,
  onDeleteThread,
  onDeleteFolder,
  onTogglePin,
  onMarkUnread,
  onRenameThread,
  onMoveThreadDown,
  onCreateFolderAndMoveThread,
  width,
  collapsed,
  onExpand,
}: {
  threads: ChatThread[];
  folders: ChatFolder[];
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onCreateFolder: (name: string) => void;
  onMoveThread: (threadId: string, folderId: string | null) => void;
  onDeleteThread: (threadId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onTogglePin: (threadId: string) => void;
  onMarkUnread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => void;
  onMoveThreadDown: (threadId: string) => void;
  onCreateFolderAndMoveThread: (threadId: string, name: string) => void;
  width: number;
  collapsed: boolean;
  onExpand: () => void;
}) {
  const [search, setSearch] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [menuThreadId, setMenuThreadId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = useMemo(
    () => threads.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())),
    [threads, search],
  );

  const pinnedThreads = filtered.filter((t) => t.pinned);
  const unpinnedThreads = filtered.filter((t) => !t.pinned);

  const buckets: Record<string, ChatThread[]> = { Heute: [], Gestern: [], Älter: [] };
  for (const thread of unpinnedThreads) buckets[dayBucket(thread.updatedAt)].push(thread);

  function submitFolder() {
    if (folderName.trim()) onCreateFolder(folderName.trim());
    setFolderName("");
    setAddingFolder(false);
  }

  function openMenuAt(threadId: string, x: number, y: number) {
    setMenuThreadId(threadId);
    setMenuPosition({ x, y });
  }

  function startRename(thread: ChatThread) {
    setRenamingThreadId(thread.id);
    setRenameValue(thread.title);
    setMenuThreadId(null);
  }

  function commitRename() {
    if (renamingThreadId && renameValue.trim()) onRenameThread(renamingThreadId, renameValue.trim());
    setRenamingThreadId(null);
  }

  function handleSelectThread(threadId: string) {
    onSelectThread(threadId);
  }

  function openInNewTab(threadId: string) {
    window.open(`/finaraai?thread=${threadId}`, "_blank");
  }

  /** P/U/R/D shortcuts fire while a thread row itself has focus (not while typing in an input),
   *  matching the product request "ohne dass das Kontextmenü geöffnet sein muss". */
  function handleRowKeyDown(e: KeyboardEvent<HTMLDivElement>, thread: ChatThread) {
    if (renamingThreadId) return;
    const key = e.key.toLowerCase();
    if (key === "p") {
      e.preventDefault();
      onTogglePin(thread.id);
    } else if (key === "u") {
      e.preventDefault();
      onMarkUnread(thread.id);
    } else if (key === "r") {
      e.preventDefault();
      startRename(thread);
    } else if (key === "d") {
      e.preventDefault();
      onDeleteThread(thread.id);
    }
  }

  function renderThreadRow(thread: ChatThread) {
    const isRenaming = renamingThreadId === thread.id;
    return (
      <div
        key={thread.id}
        tabIndex={0}
        onKeyDown={(e) => handleRowKeyDown(e, thread)}
        onContextMenu={(e) => {
          e.preventDefault();
          openMenuAt(thread.id, e.clientX, e.clientY);
        }}
        className="group flex items-center gap-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-teal"
      >
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setRenamingThreadId(null);
            }}
            className="flex-1 rounded-lg border border-brand-teal px-2.5 py-1.5 text-sm outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => handleSelectThread(thread.id)}
            className={cn(
              "flex flex-1 items-center gap-1.5 truncate rounded-lg px-2.5 py-2 text-left text-sm",
              activeThreadId === thread.id
                ? "bg-brand-teal-light text-brand-teal font-medium"
                : "text-foreground/70 hover:bg-surface-hover",
            )}
          >
            {thread.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-teal" />}
            <span className={cn("truncate", thread.unread && "font-semibold text-foreground")}>{thread.title}</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => openMenuAt(thread.id, e.currentTarget.getBoundingClientRect().left, e.currentTarget.getBoundingClientRect().bottom + 4)}
          aria-label={`Optionen für "${thread.title}"`}
          title="Optionen"
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:bg-surface-hover hover:text-foreground group-hover:flex"
        >
          <MoreHorizontalIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Collapsed: "Neuer Chat" stays a real action (bare icon, still creates a chat). Folder/thread
  // rows have no icon of their own, so a full AppSidebar-style rail of one icon per thread would
  // just be a wall of identical bubbles — instead, Ordner and Suche each get one representative
  // icon that expands the sidebar back out, so the collapsed rail still shows *what's* in here,
  // not just that something is.
  if (collapsed) {
    return (
      <div className="flex h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-brand-border bg-surface py-4">
        <button
          type="button"
          onClick={onNewChat}
          aria-label="Neuer Chat"
          title="Neuer Chat"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-teal text-brand-teal hover:bg-brand-teal-light"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
        <div className="my-1 h-px w-8 bg-brand-border" />
        <button
          type="button"
          onClick={onExpand}
          aria-label="Ordner anzeigen"
          title="Ordner anzeigen"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/50 hover:bg-surface-hover hover:text-foreground"
        >
          <FolderIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label="Chats durchsuchen"
          title="Chats durchsuchen"
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/50 hover:bg-surface-hover hover:text-foreground"
        >
          <SearchIcon className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const menuThread = menuThreadId ? threads.find((t) => t.id === menuThreadId) : undefined;

  return (
    <div className="flex h-full shrink-0 flex-col border-r border-brand-border bg-surface" style={{ width }}>
      <div className="space-y-3 border-b border-brand-border p-4">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-teal-light"
        >
          <PlusIcon className="h-4 w-4" />
          Neuer Chat
        </button>
        <div className="flex items-center gap-2 rounded-full border border-brand-border px-3 py-1.5">
          <SearchIcon className="h-4 w-4 text-foreground/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chats durchsuchen…"
            className="w-full text-sm outline-none"
          />
        </div>
      </div>

      <div className="border-b border-brand-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Ordner</span>
          <button
            type="button"
            onClick={() => setAddingFolder((v) => !v)}
            aria-label="Ordner hinzufügen"
            className="flex h-6 w-6 items-center justify-center rounded-full text-foreground/40 hover:bg-surface-hover hover:text-foreground"
          >
            <PlusIcon className="h-4 w-4" />
          </button>
        </div>
        {addingFolder && (
          <div className="mb-2 flex gap-2">
            <input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitFolder()}
              placeholder="Ordnername"
              className="flex-1 rounded-lg border border-brand-border px-2 py-1 text-xs outline-none focus:border-brand-teal"
            />
            <button
              type="button"
              onClick={submitFolder}
              className="rounded-lg bg-brand-teal px-2 py-1 text-xs font-semibold text-white"
            >
              OK
            </button>
          </div>
        )}
        <div className="space-y-1">
          {folders.length === 0 && !addingFolder && (
            <p className="text-xs text-foreground/40">Noch keine Ordner angelegt.</p>
          )}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="group flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-foreground/70"
            >
              <FolderIcon className="h-4 w-4 shrink-0 text-foreground/40" />
              <span className="flex-1 truncate">{folder.name}</span>
              <button
                type="button"
                onClick={() => onDeleteFolder(folder.id)}
                aria-label={`Ordner "${folder.name}" löschen`}
                title="Ordner löschen"
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full text-foreground/40 hover:bg-risk-high/10 hover:text-risk-high group-hover:flex"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {pinnedThreads.length > 0 && (
          <div className="mb-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">Angepinnt</div>
            <div className="space-y-1">{pinnedThreads.map(renderThreadRow)}</div>
          </div>
        )}
        {(["Heute", "Gestern", "Älter"] as const).map(
          (bucket) =>
            buckets[bucket].length > 0 && (
              <div key={bucket} className="mb-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">{bucket}</div>
                <div className="space-y-1">{buckets[bucket].map(renderThreadRow)}</div>
              </div>
            ),
        )}
        {filtered.length === 0 && <p className="text-xs text-foreground/40">Keine Chats gefunden.</p>}
      </div>

      {menuThread && (
        <ChatContextMenu
          thread={menuThread}
          folders={folders}
          position={menuPosition}
          onClose={() => setMenuThreadId(null)}
          onTogglePin={() => {
            onTogglePin(menuThread.id);
            setMenuThreadId(null);
          }}
          onMarkUnread={() => {
            onMarkUnread(menuThread.id);
            setMenuThreadId(null);
          }}
          onStartRename={() => startRename(menuThread)}
          onMoveToFolder={(folderId) => {
            onMoveThread(menuThread.id, folderId);
            setMenuThreadId(null);
          }}
          onCreateFolderAndMove={(name) => {
            onCreateFolderAndMoveThread(menuThread.id, name);
            setMenuThreadId(null);
          }}
          onDelete={() => {
            onDeleteThread(menuThread.id);
            setMenuThreadId(null);
          }}
          onOpenNewTab={() => {
            openInNewTab(menuThread.id);
            setMenuThreadId(null);
          }}
          onMoveDown={() => {
            onMoveThreadDown(menuThread.id);
            setMenuThreadId(null);
          }}
        />
      )}
    </div>
  );
}
