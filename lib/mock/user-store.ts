import { AppUser, AssetClass, PortfolioPosition, RiskProfile } from "@/lib/types";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * Dev-only convenience persistence: without Supabase configured, app_users/
 * portfolio_positions would otherwise live only in this Node process's memory
 * and reset on every dev-server restart, forcing onboarding again each time.
 * This writes the same state to a local JSON file instead — still not a real
 * database (no concurrency safety, single-machine only), just enough so a
 * restart doesn't wipe onboarding progress during development.
 */
const dataDir = path.join(process.cwd(), ".data");
const storeFile = path.join(dataDir, "mock-store.json");

interface StoreShape {
  users: [string, AppUser][];
  positions: [string, PortfolioPosition[]][];
}

function loadStore(): StoreShape {
  try {
    return JSON.parse(readFileSync(storeFile, "utf8"));
  } catch {
    return { users: [], positions: [] };
  }
}

const initial = loadStore();
const users = new Map<string, AppUser>(initial.users);
const positions = new Map<string, PortfolioPosition[]>(initial.positions);

function persist() {
  try {
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      storeFile,
      JSON.stringify({ users: Array.from(users.entries()), positions: Array.from(positions.entries()) }),
    );
  } catch {
    // best-effort — falls back silently to in-memory-only behavior if the filesystem is read-only.
  }
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
  persist();
  return created;
}

export function mockUpdateRiskProfile(userId: string, riskProfile: RiskProfile) {
  const user = users.get(userId);
  if (user) {
    user.riskProfile = riskProfile;
    persist();
  }
}

export function mockUpdateWhatsappNumber(userId: string, whatsappNumber: string | null) {
  const user = users.get(userId);
  if (user) {
    user.whatsappNumber = whatsappNumber;
    persist();
  }
}

export function mockSetDepotConnected(userId: string, connected: boolean) {
  const user = users.get(userId);
  if (user) {
    user.depotConnected = connected;
    persist();
  }
}

export function mockMarkOnboardingCompleted(userId: string) {
  const user = users.get(userId);
  if (user && !user.onboardingCompletedAt) {
    user.onboardingCompletedAt = new Date().toISOString();
    persist();
  }
}

export function mockGetPortfolioPositions(userId: string): PortfolioPosition[] {
  return positions.get(userId) ?? [];
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
  persist();
}

export function mockRemovePortfolioPosition(userId: string, positionId: string) {
  const list = positions.get(userId) ?? [];
  positions.set(
    userId,
    list.filter((p) => p.id !== positionId),
  );
  persist();
}
