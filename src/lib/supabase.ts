import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** True only when both Lovable Cloud env vars are set. */
export const supabaseConfigured = Boolean(url && key);

/** Null when unconfigured — the app must not crash, it just shows debates with voting disabled. */
export const supabase: SupabaseClient | null =
  supabaseConfigured && url && key ? createClient(url, key) : null;
