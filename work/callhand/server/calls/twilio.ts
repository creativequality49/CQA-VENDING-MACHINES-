// Twilio: request signature checks and sending texts.
import twilio from 'twilio';
import { env } from '../env';
import { E164, toE164 } from '../../shared/phone';

export function twilioConfigured() {
  return /^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID)
    && env.TWILIO_AUTH_TOKEN.length >= 20
    && E164.test(env.TWILIO_PHONE_NUMBER.replace(/[^\d+]/g, ''));
}

export function publicUrl(path: string) {
  return `${env.APP_URL}${path}`;
}

// Twilio signs each webhook with the auth token over the exact public URL and
// the posted form fields.
export function validTwilioWebhook(signature: string, path: string, params: Record<string, string>, authToken = env.TWILIO_AUTH_TOKEN) {
  if (!signature || !authToken) return false;
  return twilio.validateRequest(authToken, signature, publicUrl(path), params);
}

// ConversationRelay signs the WebSocket upgrade against the public wss:// URL,
// query string included, with no body parameters.
export function validTwilioWebSocket(signature: string, pathAndQuery: string, authToken = env.TWILIO_AUTH_TOKEN) {
  if (!signature || !authToken) return false;
  const url = new URL(pathAndQuery, env.APP_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return twilio.validateRequest(authToken, signature, url.toString(), {});
}

export type SendSms = (input: { to: string; body: string; from?: string | null }) => Promise<{ sid: string }>;

// `from` lets the alert come from the number the caller rang, so the owner
// recognises their business line. It must be a number on this Twilio account.
export const sendSms: SendSms = async (input) => {
  const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, { autoRetry: true, maxRetries: 2 });
  const from = toE164(input.from) ?? env.TWILIO_PHONE_NUMBER.replace(/[^\d+]/g, '');
  const to = toE164(input.to);
  if (!to) throw new Error('INVALID_RECIPIENT');
  const message = await client.messages.create({ from, to, body: input.body });
  return { sid: message.sid };
};
