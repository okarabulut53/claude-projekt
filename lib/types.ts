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
  /** Trading volume for this bar, when known. Undefined (not 0) when no volume data was
   *  available for this point — lib/analysis/volume.ts treats undefined as "unavailable", not
   *  as a real zero-volume day. */
  volume?: number;
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
  /** Also doubles as the "Projekt"-Zuordnung in the context menu's "Zum Projekt hinzufügen" —
   *  finara already has exactly this concept (a named group a thread can belong to) as
   *  ChatFolder, so the context menu reuses it under the "Projekt" label instead of introducing a
   *  second, parallel grouping entity. */
  folderId: string | null;
  title: string;
  pinned: boolean;
  unread: boolean;
  /** Manual list position (lower = earlier). Newly created threads get a very negative value
   *  (derived from -Date.now()) so they sort first by default, matching the previous
   *  updated-at-desc ordering; "Nach unten verschieben" swaps this value with the next thread's. */
  sortOrder: number;
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
