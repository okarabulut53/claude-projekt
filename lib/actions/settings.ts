"use server";

import { revalidatePath } from "next/cache";
import { updateRiskProfile, updateWhatsappNumber } from "@/lib/db";
import { requireUserId } from "@/lib/current-user";
import { RiskProfile } from "@/lib/types";

export async function updateRiskProfileSetting(formData: FormData) {
  const userId = await requireUserId();
  const riskProfile = String(formData.get("riskProfile") ?? "") as RiskProfile;
  if (!["low", "medium", "high"].includes(riskProfile)) {
    throw new Error("Ungültiges Risikoprofil");
  }
  await updateRiskProfile(userId, riskProfile);
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updateWhatsappSetting(formData: FormData) {
  const userId = await requireUserId();
  const number = String(formData.get("whatsappNumber") ?? "").trim();
  await updateWhatsappNumber(userId, number || null);
  revalidatePath("/settings");
}
