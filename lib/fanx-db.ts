import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://rjxiuukphwybujuclenn.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_eycv4056PKiBgUMYrA1sHA_dRCIMMBb";

export function getFanXDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function hasFanXServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
