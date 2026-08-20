import {
  AppUser,
  AssetClass,
  ChatFolder,
  ChatMessage,
  ChatThread,
  PortfolioPosition,
  RiskProfile,
  WatchlistItem,
} from "@/lib/types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * Dev-only convenience persistence: without Supabase configured, app_users/
 * portfolio_positions would otherwise live only in this Node process's memory
 * and reset on every dev-server restart, forcing onboarding again each time.
 * This writes the same state to a local JSON file instead — still not a real
 * database (no concurrency safety, single-machine only), just enough so a
 * restart doesn't wipe onboarding progress during development.
 */
const dataDir = path.join(process.cwd(), ".data");
const storeFile = path.join(dataDir, "mock-store.json");

interface StoreShape {
  users: [string, AppUser][];
  positions: [string, PortfolioPosition[]][];
  watchlist: [string, WatchlistItem[]][];
  chatFolders: [string, ChatFolder[]][];
  chatThreads: [string, ChatThread[]][];
  chatMessages: [string, ChatMessage[]][];
}

function loadStore(): StoreShape {
  try {
    const parsed = JSON.parse(readFileSync(storeFile, "utf8"));
    return {
      users: parsed.users ?? [],
      positions: parsed.positions ?? [],
      watchlist: parsed.watchlist ?? [],
      chatFolders: parsed.chatFolders ?? [],
      chatThreads: parsed.chatThreads ?? [],
      chatMessages: parsed.chatMessages ?? [],
    };
  } catch {
    return { users: [], positions: [], watchlist: [], chatFolders: [], chatThreads: [], chatMessages: [] };
  }
}

const initial = loadStore();
const users = new Map<string, AppUser>(initial.users);
const positions = new Map<string, PortfolioPosition[]>(initial.positions);
const watchlist = new Map<string, WatchlistItem[]>(initial.watchlist);
const chatFolders = new Map<string, ChatFolder[]>(initial.chatFolders);
// Backfills pinned/unread/sortOrder for threads persisted before those fields existed (older
// .data/mock-store.json files) — sortOrder falls back to -updatedAt so pre-existing chats keep
// the same newest-first order they had under the old updated-at-desc sort.
const chatThreads = new Map<string, ChatThread[]>(
  initial.chatThreads.map(([userId, threads]) => [
    userId,
    threads.map((t) => ({
      ...t,
      pinned: t.pinned ?? false,
      unread: t.unread ?? false,
      sortOrder: t.sortOrder ?? -Date.parse(t.updatedAt),
    })),
  ]),
);
const chatMessages = new Map<string, ChatMessage[]>(initial.chatMessages);

function persist() {
  try {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      storeFile,
      JSON.stringify({
        users: Array.from(users.entries()),
        positions: Array.from(positions.entries()),
        watchlist: Array.from(watchlist.entries()),
        chatFolders: Array.from(chatFolders.entries()),
        chatThreads: Array.from(chatThreads.entries()),
        chatMessages: Array.from(chatMessages.entries()),
      }),
    );
  } catch {
    // best-effort — falls back silently to in-memory-only behavior if the filesystem is read-only.
  }
}

export function mockGetOrCreateAppUser(userId: string, email: string | null): AppUser {
  const existing = users.get(userId);
  if (existing) return existing;

  const created: AppUser = {
    id: userId,
    email,
    riskProfile: null,
    whatsappNumber: null,
    depotConnected: false,
    onboardingCompletedAt: null,
    createdAt: new Date().toISOString(),
  };
  users.set(userId, created);
  persist();
  return created;
}

export function mockUpdateRiskProfile(userId: string, riskProfile: RiskProfile) {
  const user = users.get(userId);
  if (user) {
    user.riskProfile = riskProfile;
    persist();
  }
}

export function mockUpdateWhatsappNumber(userId: string, whatsappNumber: string | null) {
  const user = users.get(userId);
  if (user) {
    user.whatsappNumber = whatsappNumber;
    persist();
  }
}

export function mockSetDepotConnected(userId: string, connected: boolean) {
  const user = users.get(userId);
  if (user) {
    user.depotConnected = connected;
    persist();
  }
}

export function mockMarkOnboardingCompleted(userId: string) {
  const user = users.get(userId);
  if (user && !user.onboardingCompletedAt) {
    user.onboardingCompletedAt = new Date().toISOString();
    persist();
  }
}

export function mockGetPortfolioPositions(userId: string): PortfolioPosition[] {
  return positions.get(userId) ?? [];
}

export function mockAddPortfolioPosition(params: {
  userId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
}) {
  const list = positions.get(params.userId) ?? [];
  list.unshift({
    id: crypto.randomUUID(),
    userId: params.userId,
    symbol: params.symbol.toUpperCase(),
    name: params.name,
    assetClass: params.assetClass,
    quantity: params.quantity,
    avgPrice: params.avgPrice,
    currentPrice: params.avgPrice,
    source: "manual",
    createdAt: new Date().toISOString(),
  });
  positions.set(params.userId, list);
  persist();
}

export function mockRemovePortfolioPosition(userId: string, positionId: string) {
  const list = positions.get(userId) ?? [];
  positions.set(
    userId,
    list.filter((p) => p.id !== positionId),
  );
  persist();
}

export function mockGetWatchlist(userId: string): WatchlistItem[] {
  return watchlist.get(userId) ?? [];
}

export function mockAddWatchlistItem(userId: string, symbol: string, assetClass: AssetClass): WatchlistItem {
  const upperSymbol = symbol.toUpperCase();
  const list = watchlist.get(userId) ?? [];
  const existing = list.find((w) => w.symbol === upperSymbol);
  if (existing) return existing;

  const item: WatchlistItem = {
    id: crypto.randomUUID(),
    userId,
    symbol: upperSymbol,
    assetClass,
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  watchlist.set(userId, list);
  persist();
  return item;
}

export function mockRemoveWatchlistItem(userId: string, itemId: string) {
  const list = watchlist.get(userId) ?? [];
  watchlist.set(
    userId,
    list.filter((w) => w.id !== itemId),
  );
  persist();
}

export function mockGetChatFolders(userId: string): ChatFolder[] {
  return chatFolders.get(userId) ?? [];
}

export function mockCreateChatFolder(userId: string, name: string): ChatFolder {
  const folder: ChatFolder = {
    id: crypto.randomUUID(),
    userId,
    name,
    createdAt: new Date().toISOString(),
  };
  const list = chatFolders.get(userId) ?? [];
  list.push(folder);
  chatFolders.set(userId, list);
  persist();
  return folder;
}

/** Mirrors supabase/schema.sql's `chat_threads.folder_id references chat_folders(id) on delete
 *  set null` — deleting a folder un-assigns its threads back to "kein Ordner" rather than
 *  deleting the conversations inside it. */
export function mockDeleteChatFolder(userId: string, folderId: string) {
  chatFolders.set(
    userId,
    (chatFolders.get(userId) ?? []).filter((f) => f.id !== folderId),
  );
  for (const thread of chatThreads.get(userId) ?? []) {
    if (thread.folderId === folderId) thread.folderId = null;
  }
  persist();
}

/** Pinned first, then sortOrder ascending within each group — mirrors lib/db.ts's Supabase
 *  `.order("pinned", ...).order("sort_order", ...)` query. */
export function mockGetChatThreads(userId: string): ChatThread[] {
  return (chatThreads.get(userId) ?? [])
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder);
}

export function mockGetChatThread(userId: string, threadId: string): ChatThread | undefined {
  return (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
}

export function mockCreateChatThread(userId: string, folderId: string | null, title: string): ChatThread {
  const now = new Date().toISOString();
  const thread: ChatThread = {
    id: crypto.randomUUID(),
    userId,
    folderId,
    title,
    pinned: false,
    unread: false,
    sortOrder: -Date.now(),
    createdAt: now,
    updatedAt: now,
  };
  const list = chatThreads.get(userId) ?? [];
  list.push(thread);
  chatThreads.set(userId, list);
  persist();
  return thread;
}

export function mockTouchChatThread(userId: string, threadId: string, title?: string) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.updatedAt = new Date().toISOString();
  if (title) thread.title = title;
  persist();
}

export function mockMoveChatThread(userId: string, threadId: string, folderId: string | null) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.folderId = folderId;
  persist();
}

export function mockSetThreadPinned(userId: string, threadId: string, pinned: boolean) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.pinned = pinned;
  persist();
}

export function mockSetThreadUnread(userId: string, threadId: string, unread: boolean) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.unread = unread;
  persist();
}

/** Title-only — deliberately doesn't touch updatedAt, see lib/db.ts's renameChatThread. */
export function mockRenameChatThread(userId: string, threadId: string, title: string) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.title = title;
  persist();
}

export function mockSetThreadSortOrder(userId: string, threadId: string, sortOrder: number) {
  const thread = (chatThreads.get(userId) ?? []).find((t) => t.id === threadId);
  if (!thread) return;
  thread.sortOrder = sortOrder;
  persist();
}

export function mockDeleteChatThread(userId: string, threadId: string) {
  chatThreads.set(
    userId,
    (chatThreads.get(userId) ?? []).filter((t) => t.id !== threadId),
  );
  chatMessages.delete(threadId);
  persist();
}

export function mockGetThreadMessages(threadId: string): ChatMessage[] {
  return chatMessages.get(threadId) ?? [];
}

export function mockAppendChatMessage(threadId: string, role: ChatMessage["role"], content: string): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    threadId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  const list = chatMessages.get(threadId) ?? [];
  list.push(message);
  chatMessages.set(threadId, list);
  persist();
  return message;
}
