import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  !import.meta.env.VITE_SUPABASE_URL.includes("YOUR-PROJECT") &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Anon key only. The service-role key must never appear in the frontend.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

