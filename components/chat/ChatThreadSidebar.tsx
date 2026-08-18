"use client";

import { useMemo, useState } from "react";
import { ChatFolder, ChatThread } from "@/lib/types";
import { FolderIcon, PlusIcon, SearchIcon } from "@/components/icons/Icons";
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
  width: number;
  collapsed: boolean;
  onExpand: () => void;
}) {
  const [search, setSearch] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const filtered = useMemo(
    () => threads.filter((t) => t.title.toLowerCase().includes(search.toLowerCase())),
    [threads, search],
  );

  const buckets: Record<string, ChatThread[]> = { Heute: [], Gestern: [], Älter: [] };
  for (const thread of filtered) buckets[dayBucket(thread.updatedAt)].push(thread);

  function submitFolder() {
    if (folderName.trim()) onCreateFolder(folderName.trim());
    setFolderName("");
    setAddingFolder(false);
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
            <div key={folder.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-foreground/70">
              <FolderIcon className="h-4 w-4 text-foreground/40" />
              {folder.name}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {(["Heute", "Gestern", "Älter"] as const).map(
          (bucket) =>
            buckets[bucket].length > 0 && (
              <div key={bucket} className="mb-4">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/40">{bucket}</div>
                <div className="space-y-1">
                  {buckets[bucket].map((thread) => (
                    <div key={thread.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectThread(thread.id)}
                        className={cn(
                          "flex-1 truncate rounded-lg px-2.5 py-2 text-left text-sm",
                          activeThreadId === thread.id
                            ? "bg-brand-teal-light text-brand-teal font-medium"
                            : "text-foreground/70 hover:bg-surface-hover",
                        )}
                      >
                        {thread.title}
                      </button>
                      {folders.length > 0 && (
                        <select
                          value={thread.folderId ?? ""}
                          onChange={(e) => onMoveThread(thread.id, e.target.value || null)}
                          className="hidden w-16 rounded-lg border border-brand-border bg-surface text-[10px] text-foreground/50 group-hover:block"
                          title="In Ordner verschieben"
                        >
                          <option value="">Kein Ordner</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ),
        )}
        {filtered.length === 0 && <p className="text-xs text-foreground/40">Keine Chats gefunden.</p>}
      </div>
    </div>
  );
}
