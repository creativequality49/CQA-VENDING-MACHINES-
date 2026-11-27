// What every call leaves behind: the call marked finished, its outcome set,
// and at most one "new job" text to the owner.
//
// Both call-end paths run this (the socket closing and Twilio's
// /twilio/voice/complete callback), in either order and possibly at the same
// time. claim_call_alert makes the text go out once: the database hands the
// right to send to exactly one caller.
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildOwnerAlertSms, normalizeUrgency } from '../../shared/alertSms';
import { serviceDb } from '../db';
import { env } from '../env';
import { sendSms as twilioSendSms, twilioConfigured, type SendSms } from './twilio';

export type AlertResult = 'sent' | 'skipped' | 'failed' | 'already_handled' | 'unknown_call';

export type CompleteDeps = {
  db: () => SupabaseClient;
  sendSms: SendSms;
  smsReady: () => boolean;
  appUrl: string;
};

const defaults: CompleteDeps = { db: serviceDb, sendSms: twilioSendSms, smsReady: twilioConfigured, appUrl: env.APP_URL };

function log(level: 'info' | 'warn' | 'error', message: string, fields: Record<string, unknown>) {
  // Ids and outcome codes only, never what the caller said.
  console[level === 'info' ? 'log' : level](JSON.stringify({ level, component: 'call_complete', message, ...fields }));
}

export async function completeCall(callSid: string, options: { durationSeconds?: number | null } = {}, deps: CompleteDeps = defaults): Promise<AlertResult> {
  const db = deps.db();
  const { data: call, error } = await db.from('calls')
    .select('id,business_id,from_number,to_number,status,caller_name,callback_number,suburb,job_type,urgency,details')
    .eq('call_sid', callSid).maybeSingle();
  if (error || !call) return 'unknown_call';

  const captured = Boolean(call.job_type || call.details);
  const update: Record<string, unknown> = { status: 'completed', outcome: captured ? 'job_captured' : 'no_details' };
  if (call.status === 'in_progress') update.ended_at = new Date().toISOString();
  if (typeof options.durationSeconds === 'number' && options.durationSeconds >= 0) update.duration_seconds = Math.round(options.durationSeconds);
  await db.from('calls').update(update).eq('id', call.id);

  const { data: settings } = await db.from('receptionist_settings').select('owner_alert_number').eq('business_id', call.business_id).maybeSingle();
  const recipient = (settings?.owner_alert_number as string | null) ?? null;

  const { data: claim, error: claimError } = await db.rpc('claim_call_alert', { p_call_id: call.id, p_recipient: recipient });
  if (claimError) {
    log('error', 'Alert claim failed', { callId: call.id, code: claimError.code ?? null });
    return 'failed';
  }
  if (!claim) return 'already_handled';
  const deliveryId = claim as string;

  const settle = async (status: 'sent' | 'failed' | 'skipped', detail: string | null, providerMessageId: string | null = null) => {
    const now = new Date().toISOString();
    await db.from('alert_deliveries').update({
      status, detail: detail?.slice(0, 300) ?? null, provider_message_id: providerMessageId, updated_at: now,
      ...(status === 'sent' ? { sent_at: now } : {}),
    }).eq('id', deliveryId);
  };

  const callbackNumber = (call.callback_number as string | null) || (call.from_number as string | null);
  if (!recipient) {
    await settle('skipped', 'No owner mobile is set for alerts.');
    return 'skipped';
  }
  if (!captured && !callbackNumber && !call.caller_name) {
    await settle('skipped', 'Nothing to act on: no details and the number was withheld.');
    return 'skipped';
  }
  if (!deps.smsReady()) {
    await settle('skipped', 'Text messages are not set up on the server.');
    return 'skipped';
  }

  const body = buildOwnerAlertSms({
    callerName: call.caller_name as string | null,
    callerNumber: callbackNumber,
    suburb: call.suburb as string | null,
    jobType: call.job_type as string | null,
    urgency: normalizeUrgency(call.urgency),
    details: call.details as string | null,
    callUrl: `${deps.appUrl}/calls/${call.id}`,
  });
  try {
    const message = await deps.sendSms({ to: recipient, body, from: call.to_number as string | null });
    await settle('sent', null, message.sid);
    return 'sent';
  } catch (sendError) {
    const code = (sendError as { code?: number | string })?.code;
    await settle('failed', `Text failed to send${code ? ` (Twilio ${code})` : ''}.`);
    log('warn', 'Owner alert failed', { callId: call.id, code: code ?? null });
    return 'failed';
  }
}
