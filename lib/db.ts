import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
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
import { getInstrument } from "@/lib/mock/instruments";
import {
  mockAddPortfolioPosition,
  mockAddWatchlistItem,
  mockAppendChatMessage,
  mockCreateChatFolder,
  mockCreateChatThread,
  mockDeleteChatThread,
  mockGetChatFolders,
  mockGetChatThread,
  mockGetChatThreads,
  mockGetOrCreateAppUser,
  mockGetPortfolioPositions,
  mockGetThreadMessages,
  mockGetWatchlist,
  mockMarkOnboardingCompleted,
  mockMoveChatThread,
  mockRemovePortfolioPosition,
  mockRemoveWatchlistItem,
  mockSetDepotConnected,
  mockTouchChatThread,
  mockUpdateRiskProfile,
  mockUpdateWhatsappNumber,
} from "@/lib/mock/user-store";

interface AppUserRow {
  id: string;
  email: string | null;
  risk_profile: RiskProfile | null;
  whatsapp_number: string | null;
  depot_connected: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
}

interface PortfolioPositionRow {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  asset_class: PortfolioPosition["assetClass"];
  quantity: number;
  avg_price: number;
  source: PortfolioPosition["source"];
  created_at: string;
}

function mapAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    riskProfile: row.risk_profile,
    whatsappNumber: row.whatsapp_number,
    depotConnected: row.depot_connected,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
  };
}

export async function getOrCreateAppUser(userId: string, email: string | null): Promise<AppUser> {
  if (!isSupabaseConfigured()) return mockGetOrCreateAppUser(userId, email);

  const supabase = getSupabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return mapAppUser(existing as AppUserRow);

  const { data: created, error: insertError } = await supabase
    .from("app_users")
    .insert({ id: userId, email })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return mapAppUser(created as AppUserRow);
}

export async function updateRiskProfile(userId: string, riskProfile: RiskProfile) {
  if (!isSupabaseConfigured()) return mockUpdateRiskProfile(userId, riskProfile);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ risk_profile: riskProfile, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateWhatsappNumber(userId: string, whatsappNumber: string | null) {
  if (!isSupabaseConfigured()) return mockUpdateWhatsappNumber(userId, whatsappNumber);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function setDepotConnected(userId: string, connected: boolean) {
  if (!isSupabaseConfigured()) return mockSetDepotConnected(userId, connected);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ depot_connected: connected, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function markOnboardingCompleted(userId: string) {
  if (!isSupabaseConfigured()) return mockMarkOnboardingCompleted(userId);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
  if (error) throw error;
}

export async function getPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
  const positions = await getRawPortfolioPositions(userId);
  return Promise.all(
    positions.map(async (position) => {
      const instrument = await getInstrument(position.symbol);
      return { ...position, currentPrice: instrument?.price ?? position.avgPrice };
    }),
  );
}

async function getRawPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
  if (!isSupabaseConfigured()) return mockGetPortfolioPositions(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as PortfolioPositionRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    name: row.name,
    assetClass: row.asset_class,
    quantity: Number(row.quantity),
    avgPrice: Number(row.avg_price),
    currentPrice: Number(row.avg_price),
    source: row.source,
    createdAt: row.created_at,
  }));
}

export async function addPortfolioPosition(params: {
  userId: string;
  symbol: string;
  name: string;
  assetClass: PortfolioPosition["assetClass"];
  quantity: number;
  avgPrice: number;
}) {
  if (!isSupabaseConfigured()) return mockAddPortfolioPosition(params);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("portfolio_positions").insert({
    user_id: params.userId,
    symbol: params.symbol.toUpperCase(),
    name: params.name,
    asset_class: params.assetClass,
    quantity: params.quantity,
    avg_price: params.avgPrice,
    source: "manual",
  });
  if (error) throw error;
}

export async function removePortfolioPosition(userId: string, positionId: string) {
  if (!isSupabaseConfigured()) return mockRemovePortfolioPosition(userId, positionId);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", positionId)
    .eq("user_id", userId);
  if (error) throw error;
}

interface WatchlistItemRow {
  id: string;
  user_id: string;
  symbol: string;
  asset_class: AssetClass;
  created_at: string;
}

function mapWatchlistItem(row: WatchlistItemRow): WatchlistItem {
  return { id: row.id, userId: row.user_id, symbol: row.symbol, assetClass: row.asset_class, createdAt: row.created_at };
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  if (!isSupabaseConfigured()) return mockGetWatchlist(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as WatchlistItemRow[]).map(mapWatchlistItem);
}

export async function addWatchlistItem(userId: string, symbol: string, assetClass: AssetClass): Promise<WatchlistItem> {
  if (!isSupabaseConfigured()) return mockAddWatchlistItem(userId, symbol, assetClass);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("watchlist_items")
    .upsert({ user_id: userId, symbol: symbol.toUpperCase(), asset_class: assetClass }, { onConflict: "user_id,symbol" })
    .select("*")
    .single();
  if (error) throw error;
  return mapWatchlistItem(data as WatchlistItemRow);
}

export async function removeWatchlistItem(userId: string, itemId: string) {
  if (!isSupabaseConfigured()) return mockRemoveWatchlistItem(userId, itemId);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("watchlist_items").delete().eq("id", itemId).eq("user_id", userId);
  if (error) throw error;
}

interface ChatFolderRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

function mapChatFolder(row: ChatFolderRow): ChatFolder {
  return { id: row.id, userId: row.user_id, name: row.name, createdAt: row.created_at };
}

export async function getChatFolders(userId: string): Promise<ChatFolder[]> {
  if (!isSupabaseConfigured()) return mockGetChatFolders(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_folders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ChatFolderRow[]).map(mapChatFolder);
}

export async function createChatFolder(userId: string, name: string): Promise<ChatFolder> {
  if (!isSupabaseConfigured()) return mockCreateChatFolder(userId, name);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_folders")
    .insert({ user_id: userId, name })
    .select("*")
    .single();
  if (error) throw error;
  return mapChatFolder(data as ChatFolderRow);
}

interface ChatThreadRow {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

function mapChatThread(row: ChatThreadRow): ChatThread {
  return {
    id: row.id,
    userId: row.user_id,
    folderId: row.folder_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getChatThreads(userId: string): Promise<ChatThread[]> {
  if (!isSupabaseConfigured()) return mockGetChatThreads(userId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ChatThreadRow[]).map(mapChatThread);
}

export async function getChatThread(userId: string, threadId: string): Promise<ChatThread | undefined> {
  if (!isSupabaseConfigured()) return mockGetChatThread(userId, threadId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", threadId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapChatThread(data as ChatThreadRow) : undefined;
}

export async function createChatThread(userId: string, folderId: string | null, title: string): Promise<ChatThread> {
  if (!isSupabaseConfigured()) return mockCreateChatThread(userId, folderId, title);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_threads")
    .insert({ user_id: userId, folder_id: folderId, title })
    .select("*")
    .single();
  if (error) throw error;
  return mapChatThread(data as ChatThreadRow);
}

export async function touchChatThread(userId: string, threadId: string, title?: string) {
  if (!isSupabaseConfigured()) return mockTouchChatThread(userId, threadId, title);

  const supabase = getSupabaseAdmin();
  const update: { updated_at: string; title?: string } = { updated_at: new Date().toISOString() };
  if (title) update.title = title;
  const { error } = await supabase.from("chat_threads").update(update).eq("id", threadId).eq("user_id", userId);
  if (error) throw error;
}

export async function moveChatThread(userId: string, threadId: string, folderId: string | null) {
  if (!isSupabaseConfigured()) return mockMoveChatThread(userId, threadId, folderId);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("chat_threads")
    .update({ folder_id: folderId })
    .eq("id", threadId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteChatThread(userId: string, threadId: string) {
  if (!isSupabaseConfigured()) return mockDeleteChatThread(userId, threadId);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId).eq("user_id", userId);
  if (error) throw error;
}

interface ChatMessageRow {
  id: string;
  thread_id: string;
  role: ChatMessage["role"];
  content: string;
  created_at: string;
}

function mapChatMessage(row: ChatMessageRow): ChatMessage {
  return { id: row.id, threadId: row.thread_id, role: row.role, content: row.content, createdAt: row.created_at };
}

export async function getThreadMessages(threadId: string): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured()) return mockGetThreadMessages(threadId);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ChatMessageRow[]).map(mapChatMessage);
}

export async function appendChatMessage(
  threadId: string,
  role: ChatMessage["role"],
  content: string,
): Promise<ChatMessage> {
  if (!isSupabaseConfigured()) return mockAppendChatMessage(threadId, role, content);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ thread_id: threadId, role, content })
    .select("*")
    .single();
  if (error) throw error;
  return mapChatMessage(data as ChatMessageRow);
}
