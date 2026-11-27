// Twilio voice webhooks. Every request must carry a valid Twilio signature.
import express, { type RequestHandler, Router } from 'express';
import twilio from 'twilio';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceDb } from '../db';
import { callTokenConfigured, env, openaiConfigured, publicHttps, serviceRoleConfigured } from '../env';
import { toE164 } from '../../shared/phone';
import { completeCall } from '../calls/complete';
import { welcomeGreeting } from '../calls/prompt';
import { SETTINGS_COLUMNS } from '../calls/store';
import { issueCallToken } from '../calls/token';
import { twilioConfigured, validTwilioWebhook } from '../calls/twilio';

export const MAX_CONCURRENT_CALLS = 5;
export const MAX_CALLS_PER_CALLER_PER_HOUR = 6;

export type TwilioRouteDeps = {
  db: () => SupabaseClient;
  validSignature: (signature: string, path: string, params: Record<string, string>) => boolean;
  ready: () => { ok: boolean; missing: string[] };
  complete: typeof completeCall;
};

export function serverReadiness() {
  const missing: string[] = [];
  if (!twilioConfigured()) missing.push('Twilio account');
  if (!openaiConfigured()) missing.push('OpenAI key');
  if (!serviceRoleConfigured()) missing.push('Supabase service key');
  if (!callTokenConfigured()) missing.push('call token secret');
  if (!publicHttps()) missing.push('public HTTPS address');
  return { ok: missing.length === 0, missing };
}

const defaults: TwilioRouteDeps = { db: serviceDb, validSignature: validTwilioWebhook, ready: serverReadiness, complete: completeCall };

const say = (response: twilio.twiml.VoiceResponse, text: string) => response.say({ language: 'en-AU' }, text);

function relayUrl(token: string) {
  const url = new URL('/twilio/relay', env.APP_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

export function twilioRouter(deps: TwilioRouteDeps = defaults) {
  const router = Router();
  router.use(express.urlencoded({ extended: false, limit: '64kb' }));

  const signed = (path: string): RequestHandler => (req, res, next) => {
    const params = Object.fromEntries(Object.entries((req.body ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]));
    if (!deps.validSignature(req.header('x-twilio-signature') ?? '', path, params)) {
      res.status(403).type('text/plain').send('Invalid signature');
      return;
    }
    next();
  };

  router.post('/voice', signed('/twilio/voice'), async (req, res) => {
    const response = new twilio.twiml.VoiceResponse();
    const sendTwiml = () => res.type('text/xml').send(response.toString());
    const to = toE164(String(req.body.To ?? ''));
    const from = toE164(String(req.body.From ?? ''));
    const callSid = String(req.body.CallSid ?? '');
    if (!to || !/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
      say(response, 'Sorry, this call could not be connected.');
      return sendTwiml();
    }

    const db = deps.db();
    const { data: number } = await db.from('phone_numbers').select('business_id').eq('phone_number', to).eq('active', true).maybeSingle();
    if (!number) {
      say(response, 'Sorry, this number is not set up yet. Please try again later.');
      return sendTwiml();
    }
    const businessId = number.business_id as string;
    const [{ data: business }, { data: settings }] = await Promise.all([
      db.from('businesses').select('name').eq('id', businessId).maybeSingle(),
      db.from('receptionist_settings').select(SETTINGS_COLUMNS).eq('business_id', businessId).maybeSingle(),
    ]);
    const name = (business?.name as string | undefined) ?? 'us';
    if (!settings?.enabled || !deps.ready().ok) {
      say(response, `Thanks for calling ${name}. We can't take your call right now. Please try again a bit later.`);
      return sendTwiml();
    }

    // Spend and abuse limits, checked before the AI is connected. A failed
    // count lets the call through: one database hiccup must not turn every
    // customer away.
    try {
      const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
      const [active, fromCaller] = await Promise.all([
        db.from('calls').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'in_progress').gte('started_at', hourAgo),
        from
          ? db.from('calls').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('from_number', from).gte('started_at', hourAgo)
          : Promise.resolve({ count: 0, error: null }),
      ]);
      if (!active.error && (active.count ?? 0) >= MAX_CONCURRENT_CALLS) {
        say(response, `Thanks for calling ${name}. All our lines are busy. Please try again in a few minutes.`);
        return sendTwiml();
      }
      if (!fromCaller.error && (fromCaller.count ?? 0) >= MAX_CALLS_PER_CALLER_PER_HOUR) {
        say(response, `Thanks for calling ${name}. We already have your recent calls and the team will be in touch.`);
        return sendTwiml();
      }
    } catch {
      // fall through and take the call
    }

    const { error: insertError } = await db.from('calls').upsert(
      { business_id: businessId, call_sid: callSid, from_number: from, to_number: to, status: 'in_progress' },
      { onConflict: 'call_sid', ignoreDuplicates: true },
    );
    if (insertError) {
      say(response, `Thanks for calling ${name}. We can't take your call right now. Please try again a bit later.`);
      return sendTwiml();
    }

    const connect = response.connect({ action: `${env.APP_URL}/twilio/voice/complete` });
    connect.conversationRelay({
      url: relayUrl(issueCallToken({ businessId, callSid })),
      welcomeGreeting: welcomeGreeting(settings as { greeting: string; assistant_name: string }),
      language: 'en-AU',
      interruptible: 'any',
    });
    return sendTwiml();
  });

  // Twilio calls this when the AI session ends. Second call-end path: if the
  // socket dropped without a clean close, this still finishes the call and
  // sends the owner's alert (once; see completeCall).
  router.post('/voice/complete', signed('/twilio/voice/complete'), async (req, res) => {
    const callSid = String(req.body.CallSid ?? '');
    if (/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
      const duration = Number(req.body.SessionDuration ?? req.body.CallDuration);
      try {
        await deps.complete(callSid, { durationSeconds: Number.isFinite(duration) ? duration : null });
      } catch {
        // Logged inside; Twilio still needs its TwiML.
      }
    }
    const response = new twilio.twiml.VoiceResponse();
    response.hangup();
    res.type('text/xml').send(response.toString());
  });

  return router;
}
