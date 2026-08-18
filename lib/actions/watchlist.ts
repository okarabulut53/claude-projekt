"use server";

import { revalidatePath } from "next/cache";
import { addWatchlistItem, getWatchlist, removeWatchlistItem } from "@/lib/db";
import { requireUserId } from "@/lib/current-user";
import { AssetClass, WatchlistItem } from "@/lib/types";

export async function listWatchlist(): Promise<WatchlistItem[]> {
  const userId = await requireUserId();
  return getWatchlist(userId);
}

export async function addToWatchlist(symbol: string, assetClass: AssetClass): Promise<void> {
  const userId = await requireUserId();
  if (!symbol.trim()) throw new Error("Symbol fehlt.");
  await addWatchlistItem(userId, symbol, assetClass);
  revalidatePath("/watchlist");
  revalidatePath("/finaraai");
}

export async function removeFromWatchlist(itemId: string): Promise<void> {
  const userId = await requireUserId();
  await removeWatchlistItem(userId, itemId);
  revalidatePath("/watchlist");
  revalidatePath("/finaraai");
}
