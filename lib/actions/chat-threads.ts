"use server";

import { revalidatePath } from "next/cache";
import {
  createChatFolder,
  createChatThread,
  deleteChatFolder,
  deleteChatThread,
  getChatFolders,
  getChatThreads,
  getThreadMessages,
  moveChatThread,
  moveThreadDown,
  renameChatThread,
  setThreadPinned,
  setThreadUnread,
} from "@/lib/db";
import { requireUserId } from "@/lib/current-user";
import { ChatFolder, ChatMessage, ChatThread } from "@/lib/types";

export async function listChatFolders(): Promise<ChatFolder[]> {
  const userId = await requireUserId();
  return getChatFolders(userId);
}

export async function listChatThreads(): Promise<ChatThread[]> {
  const userId = await requireUserId();
  return getChatThreads(userId);
}

export async function getThreadHistory(threadId: string): Promise<ChatMessage[]> {
  await requireUserId();
  return getThreadMessages(threadId);
}

export async function startNewChatThread(): Promise<ChatThread> {
  const userId = await requireUserId();
  const thread = await createChatThread(userId, null, "Neuer Chat");
  revalidatePath("/finaraai");
  return thread;
}

export async function createFolder(name: string): Promise<ChatFolder> {
  const userId = await requireUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Ordnername darf nicht leer sein.");
  const folder = await createChatFolder(userId, trimmed);
  revalidatePath("/finaraai");
  return folder;
}

export async function moveThreadToFolder(threadId: string, folderId: string | null): Promise<void> {
  const userId = await requireUserId();
  await moveChatThread(userId, threadId, folderId);
  revalidatePath("/finaraai");
}

export async function removeChatThread(threadId: string): Promise<void> {
  const userId = await requireUserId();
  await deleteChatThread(userId, threadId);
  revalidatePath("/finaraai");
}

export async function removeChatFolder(folderId: string): Promise<void> {
  const userId = await requireUserId();
  await deleteChatFolder(userId, folderId);
  revalidatePath("/finaraai");
}

export async function setThreadPinnedState(threadId: string, pinned: boolean): Promise<void> {
  const userId = await requireUserId();
  await setThreadPinned(userId, threadId, pinned);
  revalidatePath("/finaraai");
}

export async function setThreadUnreadState(threadId: string, unread: boolean): Promise<void> {
  const userId = await requireUserId();
  await setThreadUnread(userId, threadId, unread);
  revalidatePath("/finaraai");
}

export async function renameThread(threadId: string, title: string): Promise<void> {
  const userId = await requireUserId();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Chat-Titel darf nicht leer sein.");
  await renameChatThread(userId, threadId, trimmed);
  revalidatePath("/finaraai");
}

export async function moveThreadDownAction(threadId: string): Promise<void> {
  const userId = await requireUserId();
  await moveThreadDown(userId, threadId);
  revalidatePath("/finaraai");
}
