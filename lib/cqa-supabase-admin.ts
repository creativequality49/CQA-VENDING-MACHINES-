import { requireCqaSupabaseUrl } from "@/lib/cqa-supabase-config";
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function getCqaSupabaseAdmin() {
  const url = requireCqaSupabaseUrl(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("CQA Supabase server key is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
