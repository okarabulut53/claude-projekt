"use server";

import { revalidatePath } from "next/cache";
import { addPortfolioPosition, removePortfolioPosition } from "@/lib/db";
import { requireUserId } from "@/lib/current-user";
import { AssetClass } from "@/lib/types";

export async function addPosition(formData: FormData) {
  const userId = await requireUserId();

  const symbol = String(formData.get("symbol") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const assetClass = String(formData.get("assetClass") ?? "stock") as AssetClass;
  const quantity = Number(formData.get("quantity"));
  const avgPrice = Number(formData.get("avgPrice"));

  if (!symbol || !name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(avgPrice) || avgPrice < 0) {
    throw new Error("Bitte alle Felder gültig ausfüllen.");
  }

  await addPortfolioPosition({ userId, symbol, name, assetClass, quantity, avgPrice });
  revalidatePath("/portfolio");
}

export async function removePosition(formData: FormData) {
  const userId = await requireUserId();
  const positionId = String(formData.get("positionId") ?? "");
  if (!positionId) throw new Error("Position fehlt.");
  await removePortfolioPosition(userId, positionId);
  revalidatePath("/portfolio");
}
