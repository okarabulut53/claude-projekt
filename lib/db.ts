import { getSupabaseAdmin } from "@/lib/supabase";
import { AppUser, PortfolioPosition, RiskProfile } from "@/lib/types";
import { getInstrument } from "@/lib/mock/instruments";

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
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ risk_profile: riskProfile, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function updateWhatsappNumber(userId: string, whatsappNumber: string | null) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ whatsapp_number: whatsappNumber, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function setDepotConnected(userId: string, connected: boolean) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ depot_connected: connected, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function markOnboardingCompleted(userId: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_users")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
  if (error) throw error;
}

export async function getPortfolioPositions(userId: string): Promise<PortfolioPosition[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("portfolio_positions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data as PortfolioPositionRow[]).map((row) => {
    const instrument = getInstrument(row.symbol);
    return {
      id: row.id,
      userId: row.user_id,
      symbol: row.symbol,
      name: row.name,
      assetClass: row.asset_class,
      quantity: Number(row.quantity),
      avgPrice: Number(row.avg_price),
      currentPrice: instrument?.price ?? Number(row.avg_price),
      source: row.source,
      createdAt: row.created_at,
    };
  });
}

export async function addPortfolioPosition(params: {
  userId: string;
  symbol: string;
  name: string;
  assetClass: PortfolioPosition["assetClass"];
  quantity: number;
  avgPrice: number;
}) {
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
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("portfolio_positions")
    .delete()
    .eq("id", positionId)
    .eq("user_id", userId);
  if (error) throw error;
}
