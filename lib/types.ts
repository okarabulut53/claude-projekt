export type RiskProfile = "low" | "medium" | "high";

export type AssetClass = "stock" | "etf" | "crypto";

export type HoldingPeriod =
  | "kurzfristig"
  | "kurz- bis mittelfristig"
  | "mittelfristig"
  | "langfristig";

export interface PricePoint {
  date: string;
  price: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: "EUR" | "USD";
  price: number;
  changePercent1d: number;
  changePercent30d: number;
  volatility: "niedrig" | "mittel" | "hoch";
  history: PricePoint[];
  source: "live" | "simulated";
}

export interface InvestmentOpportunity {
  id: string;
  instrument: Instrument;
  aiScore: number;
  riskLevel: RiskProfile;
  potentialEntryLow: number;
  potentialEntryHigh: number;
  holdingPeriod: HoldingPeriod;
  reasoning: string;
  risks: string;
  assessment: string;
  generatedAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  relatedSymbols: string[];
  summary: string;
  url?: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  changePercent1d: number;
  history: PricePoint[];
}

export interface PortfolioPosition {
  id: string;
  userId: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  source: "manual" | "depot";
  createdAt: string;
}

export interface AppUser {
  id: string;
  email: string | null;
  riskProfile: RiskProfile | null;
  whatsappNumber: string | null;
  depotConnected: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  assetClass: AssetClass;
  createdAt: string;
}

export interface ChatFolder {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
