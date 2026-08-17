import { AssetClass, RiskProfile } from "@/lib/types";

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          email: string | null;
          risk_profile: RiskProfile | null;
          whatsapp_number: string | null;
          depot_connected: boolean;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          risk_profile?: RiskProfile | null;
          whatsapp_number?: string | null;
          depot_connected?: boolean;
          onboarding_completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["app_users"]["Insert"]> & {
          updated_at?: string;
        };
        Relationships: [];
      };
      portfolio_positions: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          name: string;
          asset_class: AssetClass;
          quantity: number;
          avg_price: number;
          source: "manual" | "depot";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          name: string;
          asset_class: AssetClass;
          quantity: number;
          avg_price: number;
          source?: "manual" | "depot";
        };
        Update: Partial<Database["public"]["Tables"]["portfolio_positions"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
