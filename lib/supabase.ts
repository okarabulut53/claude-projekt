import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase ist noch nicht konfiguriert. Bitte SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local setzen.",
    );
  }

  client = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return client;
}
