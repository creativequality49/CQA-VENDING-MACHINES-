// Supabase-backed storage for a live call. Uses the service role, so every
// query is pinned to the business and call that the signed call token named.
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceDb } from '../db';
import type { ReceptionistSettings } from './prompt';
import type { CallStore } from './session';

export const SETTINGS_COLUMNS = 'enabled,assistant_name,greeting,about,services,service_area,hours,pricing_wording,callback_window,emergency_instructions,owner_alert_number';

export function supabaseCallStore(db: () => SupabaseClient = serviceDb): CallStore {
  return {
    async loadContext(businessId, callSid) {
      const [call, business, settings] = await Promise.all([
        db().from('calls').select('from_number').eq('business_id', businessId).eq('call_sid', callSid).maybeSingle(),
        db().from('businesses').select('name,timezone').eq('id', businessId).maybeSingle(),
        db().from('receptionist_settings').select(SETTINGS_COLUMNS).eq('business_id', businessId).maybeSingle(),
      ]);
      if (!call.data || !business.data || !settings.data) return null;
      return {
        businessId,
        businessName: business.data.name as string,
        timezone: (business.data.timezone as string) || 'Australia/Sydney',
        settings: settings.data as unknown as ReceptionistSettings,
        callerNumber: (call.data.from_number as string | null) ?? null,
      };
    },
    async saveDetails(callSid, details) {
      const { error } = await db().rpc('merge_call_details', {
        p_call_sid: callSid,
        p_caller_name: details.caller_name ?? null,
        p_callback_number: details.callback_number ?? null,
        p_suburb: details.suburb ?? null,
        p_job_type: details.job_type ?? null,
        p_urgency: details.urgency ?? null,
        p_details: details.details ?? null,
      });
      if (error) throw new Error(`SAVE_DETAILS_FAILED:${error.code ?? ''}`);
    },
    async saveTranscript(businessId, callSid, transcript) {
      const { error } = await db().from('calls').update({ transcript }).eq('business_id', businessId).eq('call_sid', callSid);
      if (error) throw new Error(`SAVE_TRANSCRIPT_FAILED:${error.code ?? ''}`);
    },
  };
}
