import { AppUser, AssetClass, PortfolioPosition, RiskProfile } from "@/lib/types";
import { getInstrument } from "@/lib/mock/instruments";

const users = new Map<string, AppUser>();
const positions = new Map<string, PortfolioPosition[]>();

function withCurrentPrice(position: PortfolioPosition): PortfolioPosition {
  const instrument = getInstrument(position.symbol);
  return { ...position, currentPrice: instrument?.price ?? position.avgPrice };
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
  return created;
}

export function mockUpdateRiskProfile(userId: string, riskProfile: RiskProfile) {
  const user = users.get(userId);
  if (user) user.riskProfile = riskProfile;
}

export function mockUpdateWhatsappNumber(userId: string, whatsappNumber: string | null) {
  const user = users.get(userId);
  if (user) user.whatsappNumber = whatsappNumber;
}

export function mockSetDepotConnected(userId: string, connected: boolean) {
  const user = users.get(userId);
  if (user) user.depotConnected = connected;
}

export function mockMarkOnboardingCompleted(userId: string) {
  const user = users.get(userId);
  if (user && !user.onboardingCompletedAt) user.onboardingCompletedAt = new Date().toISOString();
}

export function mockGetPortfolioPositions(userId: string): PortfolioPosition[] {
  return (positions.get(userId) ?? []).map(withCurrentPrice);
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
}

export function mockRemovePortfolioPosition(userId: string, positionId: string) {
  const list = positions.get(userId) ?? [];
  positions.set(
    userId,
    list.filter((p) => p.id !== positionId),
  );
}
