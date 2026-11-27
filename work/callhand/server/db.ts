// Supabase clients.
// - serviceDb(): bypasses RLS. Only for work that starts from a signed Twilio
//   request (webhooks, the call socket) or the operator script. Every query
//   made with it must be scoped by a business or call it already verified.
// - userDb(token): acts as the signed-in user, so RLS decides what they see.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let service: SupabaseClient | null = null;

export function serviceDb(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_NOT_CONFIGURED');
  service ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return service;
}

export function userDb(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
