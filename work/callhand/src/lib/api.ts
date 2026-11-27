import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly field?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  const token = data.session?.access_token;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: { ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('No connection. Check your signal and try again.', 0);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(payload.message ?? 'Something went wrong. Try again.', response.status, payload.error, payload.field);
  return payload as T;
}

export type Settings = {
  enabled: boolean;
  assistant_name: string;
  greeting: string;
  about: string;
  services: string;
  service_area: string;
  hours: string;
  pricing_wording: string;
  callback_window: string;
  emergency_instructions: string;
  owner_alert_number: string | null;
};

export type ChecklistItem = { key: string; label: string; done: boolean; hint: string };

export type Me =
  | { business: null }
  | {
    business: { id: string; name: string; timezone: string; role: 'owner' | 'staff' };
    settings: Settings;
    phoneNumbers: string[];
    checklist: { ok: boolean; items: ChecklistItem[] };
  };

export type CallSummary = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: 'in_progress' | 'completed' | 'failed';
  from_number: string | null;
  caller_name: string | null;
  callback_number: string | null;
  suburb: string | null;
  job_type: string | null;
  urgency: 'emergency' | 'urgent' | 'routine' | null;
  details: string | null;
  outcome: 'job_captured' | 'no_details' | null;
  handled_at: string | null;
};

export type CallDetail = CallSummary & { to_number: string | null; transcript: Array<{ role: 'caller' | 'receptionist'; text: string; at: string }> };
export type AlertInfo = { status: 'pending' | 'sent' | 'failed' | 'skipped'; detail: string | null; sent_at: string | null; recipient: string | null } | null;
