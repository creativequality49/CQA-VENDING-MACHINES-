// Short-lived signed capability for one call. The voice webhook issues it
// once a call is matched to a business; the call socket accepts only a
// connection presenting a valid, unexpired token for that exact call.
// Ported from Jobrin, now with its own dedicated secret.
import crypto from 'node:crypto';
import { env } from '../env';

export const CALL_TOKEN_TTL_SECONDS = 180;

export type CallTokenClaims = { businessId: string; callSid: string };

function key(secret: string) {
  if (secret.length < 32) throw new Error('CALL_TOKEN_SECRET_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(`callhand-call-token-v1|${secret}`).digest();
}

export function issueCallToken(claims: CallTokenClaims, secret = env.CALL_TOKEN_SECRET, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const body = Buffer.from(JSON.stringify({ b: claims.businessId, c: claims.callSid, exp: nowSeconds + CALL_TOKEN_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', key(secret)).update(body).digest('base64url');
  return `v1.${body}.${signature}`;
}

export function verifyCallToken(token: string, secret = env.CALL_TOKEN_SECRET, nowSeconds = Math.floor(Date.now() / 1000)): CallTokenClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return null;
    const [, body, signature] = parts;
    const expected = crypto.createHmac('sha256', key(secret)).update(body).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { b?: string; c?: string; exp?: number };
    if (!payload.b || !payload.c || typeof payload.exp !== 'number' || payload.exp < nowSeconds) return null;
    if (!/^[0-9a-fA-F-]{36}$/.test(payload.b) || !/^CA[0-9a-fA-F]{32}$/.test(payload.c)) return null;
    return { businessId: payload.b, callSid: payload.c };
  } catch {
    return null;
  }
}
