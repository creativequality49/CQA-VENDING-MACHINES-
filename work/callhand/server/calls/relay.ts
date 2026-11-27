// Twilio ConversationRelay socket. Twilio does the speech-to-text and
// text-to-speech; this socket receives what the caller said and sends back
// what the receptionist says.
//
// An upgrade is accepted only with BOTH a valid Twilio signature and an
// unexpired call token issued by /twilio/voice for that exact call.
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer } from 'ws';
import { env, openaiConfigured } from '../env';
import { completeCall } from './complete';
import { createOpenAiChat } from './openai';
import { CallSession } from './session';
import { supabaseCallStore } from './store';
import { verifyCallToken, type CallTokenClaims } from './token';
import { validTwilioWebSocket } from './twilio';

export const RELAY_PATH = '/twilio/relay';

// The part of a WebSocket the call needs (the `ws` socket satisfies it).
export interface RelaySocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message' | 'close' | 'error', listener: (data?: unknown) => void): unknown;
}

export type RelayDeps = {
  verifyToken: (token: string) => CallTokenClaims | null;
  validSignature: (signature: string, pathAndQuery: string) => boolean;
  createSession: (claims: CallTokenClaims) => CallSession;
  complete: (callSid: string) => Promise<unknown>;
};

const defaults: RelayDeps = {
  verifyToken: (token) => verifyCallToken(token),
  validSignature: (signature, pathAndQuery) => validTwilioWebSocket(signature, pathAndQuery),
  createSession: (claims) => new CallSession({
    businessId: claims.businessId,
    callSid: claims.callSid,
    store: supabaseCallStore(),
    chat: openaiConfigured() ? createOpenAiChat(env.OPENAI_API_KEY, env.OPENAI_MODEL) : null,
  }),
  complete: (callSid) => completeCall(callSid),
};

const OPEN = 1;

function log(level: 'info' | 'warn', message: string, fields: Record<string, unknown>) {
  console[level === 'info' ? 'log' : 'warn'](JSON.stringify({ level, component: 'call_relay', message, ...fields }));
}

// Decides whether an upgrade request may become a call socket.
export function authoriseUpgrade(request: Pick<IncomingMessage, 'url' | 'headers'>, deps: Pick<RelayDeps, 'verifyToken' | 'validSignature'>): CallTokenClaims | null {
  let url: URL;
  try {
    url = new URL(request.url || '/', 'http://localhost');
  } catch {
    return null;
  }
  if (url.pathname !== RELAY_PATH) return null;
  const header = request.headers['x-twilio-signature'];
  const signature = Array.isArray(header) ? header[0] : header ?? '';
  if (!deps.validSignature(signature, `${url.pathname}${url.search}`)) return null;
  return deps.verifyToken(url.searchParams.get('token') ?? '');
}

// Runs one call over an accepted socket.
export function runCall(ws: RelaySocket, claims: CallTokenClaims, deps: Pick<RelayDeps, 'createSession' | 'complete'>) {
  const session = deps.createSession(claims);
  const ready = session.start().catch(() => false);
  let closing = false;

  const send = (payload: Record<string, unknown>) => {
    if (ws.readyState === OPEN) ws.send(JSON.stringify(payload));
  };
  const hangUp = () => {
    if (closing) return;
    closing = true;
    // Let Twilio finish speaking the goodbye before the session ends.
    setTimeout(() => send({ type: 'end' }), 300);
  };

  ws.on('message', async (raw: unknown) => {
    let event: { type?: string; callSid?: string; voicePrompt?: string; last?: boolean };
    try {
      event = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (event.type === 'setup') {
      // The setup message must describe the call the token was issued for.
      if (event.callSid && event.callSid !== claims.callSid) {
        log('warn', 'Setup call did not match token', { callSid: claims.callSid });
        ws.close(1008, 'Call mismatch');
        return;
      }
      if (!(await ready)) {
        send({ type: 'text', token: "Sorry, we can't take your call right now. Please try again a bit later.", last: true });
        hangUp();
      }
      return;
    }
    if (event.type === 'prompt' && event.last !== false) {
      if (!(await ready) || closing) return;
      const result = await session.handleCallerText(String(event.voicePrompt ?? ''));
      if (result.reply) send({ type: 'text', token: result.reply, last: true });
      if (result.endCall) hangUp();
    }
    // interrupt / dtmf: replies are short; nothing to cancel.
  });

  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    try {
      await ready;
      await session.finish();
    } catch {
      // The transcript is lost, but the call's details are already saved.
    }
    try {
      await deps.complete(claims.callSid);
    } catch {
      // Logged inside; /twilio/voice/complete will try again.
    }
  };
  ws.on('close', () => { void finish(); });
  ws.on('error', () => { void finish(); });
  return { session, finished: () => finish() };
}

export function attachRelay(server: Server, deps: RelayDeps = defaults) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!(request.url || '').startsWith(RELAY_PATH)) return;
    const claims = authoriseUpgrade(request, deps);
    if (!claims) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => runCall(ws, claims, deps));
  });
  return wss;
}
