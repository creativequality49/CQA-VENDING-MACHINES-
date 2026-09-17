import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for webhook and automation routes.
 * SUPABASE_SERVICE_ROLE_KEY must only be configured in server environments.
 */
const supabaseUrl =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://placeholder.supabase.co";

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "missing-service-role-key";

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
