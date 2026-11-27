// Signed-in owner requests. The Supabase access token is verified with
// Supabase on every request; queries then run as that user (RLS applies).
// The business is always looked up from the user's membership, never taken
// from the request.
import type { NextFunction, Request, Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, supabaseConfigured } from './env';
import { userDb } from './db';

export type Membership = { businessId: string; role: 'owner' | 'staff' };

export type AuthedRequest = Request & {
  userId?: string;
  db?: SupabaseClient;
  membership?: Membership | null;
};

export type AuthDeps = {
  verify: (token: string) => Promise<string | null>;
  dbFor: (token: string) => SupabaseClient;
};

let anon: SupabaseClient | null = null;
export const defaultAuthDeps: AuthDeps = {
  async verify(token) {
    if (!supabaseConfigured()) return null;
    anon ??= createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  dbFor: userDb,
};

export function requireUser(deps: AuthDeps) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'SIGN_IN_REQUIRED', message: 'Please sign in.' });
    const userId = await deps.verify(token).catch(() => null);
    if (!userId) return res.status(401).json({ error: 'SIGN_IN_REQUIRED', message: 'Your session has expired. Please sign in again.' });
    req.userId = userId;
    req.db = deps.dbFor(token);
    const { data, error } = await req.db.from('business_members').select('business_id,role').eq('user_id', userId).limit(1).maybeSingle();
    if (error) return res.status(500).json({ error: 'MEMBERSHIP_LOOKUP_FAILED' });
    req.membership = data ? { businessId: data.business_id as string, role: data.role as Membership['role'] } : null;
    next();
  };
}

export function requireBusiness(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.membership) return res.status(409).json({ error: 'NO_BUSINESS', message: 'Set up your business first.' });
  next();
}

export function requireOwner(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.membership?.role !== 'owner') return res.status(403).json({ error: 'OWNER_ONLY', message: 'Only the business owner can change this.' });
  next();
}
