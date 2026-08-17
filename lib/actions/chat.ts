"use server";

import { currentUser } from "@clerk/nextjs/server";
import { getOrCreateAppUser, getPortfolioPositions } from "@/lib/db";
import { generateChatReply } from "@/lib/chat-engine";
import { requireUserId } from "@/lib/current-user";

export async function sendChatMessage(message: string): Promise<string> {
  const userId = await requireUserId();
  const user = await currentUser();
  const appUser = await getOrCreateAppUser(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const positions = await getPortfolioPositions(userId);

  return generateChatReply(message, appUser, positions);
}
