"use server";

import { currentUser } from "@clerk/nextjs/server";
import {
  appendChatMessage,
  createChatThread,
  getChatThread,
  getOrCreateAppUser,
  getPortfolioPositions,
  getThreadMessages,
  touchChatThread,
} from "@/lib/db";
import { ChartAttachment, generateFinaraReply } from "@/lib/finara-ai/client";
import { requireUserId } from "@/lib/current-user";

function deriveTitle(message: string) {
  const trimmed = message.trim();
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed || "Neuer Chat";
}

export async function sendChatMessage(
  message: string,
  threadId: string | null,
  chartAttachment?: ChartAttachment | null,
): Promise<{ reply: string; threadId: string }> {
  const userId = await requireUserId();
  const user = await currentUser();
  const appUser = await getOrCreateAppUser(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const positions = await getPortfolioPositions(userId);

  let thread = threadId ? await getChatThread(userId, threadId) : undefined;
  const isNewThread = !thread;
  if (!thread) {
    thread = await createChatThread(userId, null, deriveTitle(message));
  }

  const history = await getThreadMessages(thread.id);

  await appendChatMessage(thread.id, "user", message);
  const reply = await generateFinaraReply(message, appUser, positions, history, chartAttachment);
  await appendChatMessage(thread.id, "assistant", reply);
  await touchChatThread(userId, thread.id, isNewThread ? deriveTitle(message) : undefined);

  return { reply, threadId: thread.id };
}
