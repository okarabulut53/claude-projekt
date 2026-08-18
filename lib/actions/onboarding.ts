"use server";

import { redirect } from "next/navigation";
import { markOnboardingCompleted, updateRiskProfile, updateWhatsappNumber } from "@/lib/db";
import { requireUserId } from "@/lib/current-user";
import { RiskProfile } from "@/lib/types";

export async function saveWhatsappNumber(formData: FormData) {
  const userId = await requireUserId();
  const number = String(formData.get("whatsappNumber") ?? "").trim();
  await updateWhatsappNumber(userId, number || null);
  redirect("/onboarding/depot");
}

export async function skipWhatsapp() {
  await requireUserId();
  redirect("/onboarding/depot");
}

export async function skipDepot() {
  await requireUserId();
  redirect("/onboarding/risikoprofil");
}

export async function saveRiskProfile(formData: FormData) {
  const userId = await requireUserId();
  const riskProfile = String(formData.get("riskProfile") ?? "") as RiskProfile;
  if (!["low", "medium", "high"].includes(riskProfile)) {
    throw new Error("Ungültiges Risikoprofil");
  }
  await updateRiskProfile(userId, riskProfile);
  await markOnboardingCompleted(userId);
  redirect("/finaraai");
}
