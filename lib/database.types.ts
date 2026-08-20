import { AssetClass, ChatMessage, RiskProfile } from "@/lib/types";

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
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          asset_class: AssetClass;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          asset_class: AssetClass;
        };
        Update: Partial<Database["public"]["Tables"]["watchlist_items"]["Insert"]>;
        Relationships: [];
      };
      chat_folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_folders"]["Insert"]>;
        Relationships: [];
      };
      chat_threads: {
        Row: {
          id: string;
          user_id: string;
          folder_id: string | null;
          title: string;
          pinned: boolean;
          unread: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          folder_id?: string | null;
          title?: string;
          pinned?: boolean;
          unread?: boolean;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["chat_threads"]["Insert"]> & {
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          thread_id: string;
          role: ChatMessage["role"];
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: ChatMessage["role"];
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
