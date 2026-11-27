import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import test from 'node:test';
import twilio from 'twilio';
import { createApp } from '../server/app';
import { authoriseUpgrade, runCall, type RelaySocket } from '../server/calls/relay';
import type { CallSession } from '../server/calls/session';
import { issueCallToken, verifyCallToken } from '../server/calls/token';
import { validTwilioWebhook, validTwilioWebSocket } from '../server/calls/twilio';
import { env } from '../server/env';
import { MAX_CALLS_PER_CALLER_PER_HOUR, MAX_CONCURRENT_CALLS } from '../server/routes/twilio';
import { BIZ_A, BIZ_B, FakeDb, sid } from './fakeDb';

const AUTH_TOKEN = env.TWILIO_AUTH_TOKEN;
const sign = (path: string, params: Record<string, string>) => twilio.getExpectedTwilioSignature(AUTH_TOKEN, `${env.APP_URL}${path}`, params);

function seed(settings: Record<string, unknown> = {}) {
  return new FakeDb({
    phone_numbers: [
      { business_id: BIZ_A, phone_number: '+61255550101', active: true },
      { business_id: BIZ_B, phone_number: '+61255550202', active: false },
    ],
    businesses: [{ id: BIZ_A, name: 'Alpha Plumbing' }, { id: BIZ_B, name: 'Bravo Electrical' }],
    receptionist_settings: [
      { business_id: BIZ_A, enabled: true, assistant_name: 'Sam', greeting: 'Thanks for calling Alpha Plumbing.', ...settings },
      { business_id: BIZ_B, enabled: true, assistant_name: 'Jo', greeting: 'Bravo Electrical, hello.' },
    ],
    calls: [],
  });
}

async function withServer(db: FakeDb, fn: (post: (path: string, params: Record<string, string>, signature?: string) => Promise<{ status: number; body: string }>, completed: Array<[string, unknown]>) => Promise<void>, ready = true) {
  const completed: Array<[string, unknown]> = [];
  const app = createApp({
    staticDir: null,
    twilio: {
      db: () => db.client(),
      validSignature: validTwilioWebhook,
      ready: () => ({ ok: ready, missing: ready ? [] : ['OpenAI key'] }),
      complete: async (callSid, options) => { completed.push([callSid, options]); return 'sent'; },
    },
  });
  const server = http.createServer(app).listen(0);
  const port = (server.address() as AddressInfo).port;
  const post = async (path: string, params: Record<string, string>, signature = sign(path, params)) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': signature }, body: new URLSearchParams(params),
    });
    return { status: response.status, body: await response.text() };
  };
  try {
    await fn(post, completed);
  } finally {
    server.close();
  }
}

const incoming = (overrides: Record<string, string> = {}) => ({ CallSid: sid('a'), To: '+61255550101', From: '+61412345678', ...overrides });

test('requests without a valid Twilio signature are refused', async () => {
  await withServer(seed(), async (post) => {
    assert.equal((await post('/twilio/voice', incoming(), 'forged')).status, 403);
    assert.equal((await post('/twilio/voice', incoming(), '')).status, 403);
    const signedForOther = sign('/twilio/voice', incoming({ To: '+61255550202' }));
    assert.equal((await post('/twilio/voice', incoming(), signedForOther)).status, 403, 'signature must match the posted fields');
    assert.equal((await post('/twilio/voice/complete', { CallSid: sid('a') }, 'forged')).status, 403);
  });
});

test('a call to an enabled business is connected to the AI with a token for that call', async () => {
  const db = seed();
  await withServer(db, async (post) => {
    const { status, body } = await post('/twilio/voice', incoming());
    assert.equal(status, 200);
    assert.match(body, /<Connect action="https:\/\/callhand\.test\/twilio\/voice\/complete">/);
    assert.match(body, /welcomeGreeting="Thanks for calling Alpha Plumbing\. You're speaking with Sam, the AI receptionist\. How can I help\?"/);
    assert.match(body, /language="en-AU"/);
    const url = new URL(body.match(/url="([^"]+)"/)![1].replace(/&amp;/g, '&'));
    assert.equal(url.origin.replace('wss:', 'https:'), 'https://callhand.test');
    assert.equal(url.protocol, 'wss:');
    assert.equal(url.pathname, '/twilio/relay');
    assert.deepEqual(verifyCallToken(url.searchParams.get('token')!), { businessId: BIZ_A, callSid: sid('a') });
    const call = db.rows('calls')[0];
    assert.equal(call.business_id, BIZ_A);
    assert.equal(call.from_number, '+61412345678');
    assert.equal(call.status, 'in_progress');
    // Twilio retries the same call: no duplicate row.
    await post('/twilio/voice', incoming());
    assert.equal(db.rows('calls').length, 1);
  });
});

test('calls that should not reach the AI get a spoken message instead', async () => {
  await withServer(seed(), async (post) => {
    const unknown = await post('/twilio/voice', incoming({ To: '+61255559999' }));
    assert.match(unknown.body, /<Say language="en-AU">Sorry, this number is not set up yet/);
    const inactive = await post('/twilio/voice', incoming({ To: '+61255550202' }));
    assert.match(inactive.body, /not set up yet/, 'an inactive number belongs to no one');
    const badSid = await post('/twilio/voice', incoming({ CallSid: 'not-a-sid' }));
    assert.match(badSid.body, /could not be connected/);
  });
  await withServer(seed({ enabled: false }), async (post) => {
    const off = await post('/twilio/voice', incoming());
    assert.match(off.body, /Thanks for calling Alpha Plumbing\. We can't take your call right now/);
    assert.doesNotMatch(off.body, /ConversationRelay/);
  });
  await withServer(seed(), async (post) => {
    const notReady = await post('/twilio/voice', incoming());
    assert.match(notReady.body, /We can't take your call right now/);
  }, false);
});

test('busy lines and repeat callers are limited before the AI is connected', async () => {
  const recent = new Date().toISOString();
  const busy = seed();
  for (let i = 0; i < MAX_CONCURRENT_CALLS; i += 1) busy.rows('calls').push({ business_id: BIZ_A, call_sid: sid(String(i)), status: 'in_progress', from_number: `+6141200000${i}`, started_at: recent });
  await withServer(busy, async (post) => {
    assert.match((await post('/twilio/voice', incoming())).body, /All our lines are busy/);
  });

  const stale = seed();
  for (let i = 0; i < MAX_CONCURRENT_CALLS; i += 1) stale.rows('calls').push({ business_id: BIZ_A, call_sid: sid(String(i)), status: 'in_progress', from_number: '+61400000000', started_at: '2020-01-01T00:00:00.000Z' });
  await withServer(stale, async (post) => {
    assert.match((await post('/twilio/voice', incoming())).body, /ConversationRelay/, 'calls stuck in progress from long ago do not block the line');
  });

  const repeat = seed();
  for (let i = 0; i < MAX_CALLS_PER_CALLER_PER_HOUR; i += 1) repeat.rows('calls').push({ business_id: BIZ_A, call_sid: sid(String(i)), status: 'completed', from_number: '+61412345678', started_at: recent });
  await withServer(repeat, async (post) => {
    assert.match((await post('/twilio/voice', incoming())).body, /We already have your recent calls/);
  });
});

test('the call-complete callback finishes the call and hangs up', async () => {
  await withServer(seed(), async (post, completed) => {
    const params = { CallSid: sid('a'), SessionDuration: '84', SessionStatus: 'ended' };
    const { status, body } = await post('/twilio/voice/complete', params);
    assert.equal(status, 200);
    assert.match(body, /<Hangup\/>/);
    assert.deepEqual(completed, [[sid('a'), { durationSeconds: 84 }]]);
    await post('/twilio/voice/complete', { CallSid: 'junk' });
    assert.equal(completed.length, 1);
  });
});

// ---------------- The call socket ----------------

const tokenFor = (callSid = sid('a')) => issueCallToken({ businessId: BIZ_A, callSid });
const wsSign = (pathAndQuery: string) => twilio.getExpectedTwilioSignature(AUTH_TOKEN, `wss://callhand.test${pathAndQuery}`, {});
const realChecks = { verifyToken: (t: string) => verifyCallToken(t), validSignature: validTwilioWebSocket };

test('the socket only opens with a Twilio signature and a valid call token', () => {
  const path = `/twilio/relay?token=${encodeURIComponent(tokenFor())}`;
  assert.deepEqual(authoriseUpgrade({ url: path, headers: { 'x-twilio-signature': wsSign(path) } }, realChecks), { businessId: BIZ_A, callSid: sid('a') });
  assert.equal(authoriseUpgrade({ url: path, headers: {} }, realChecks), null, 'no signature');
  assert.equal(authoriseUpgrade({ url: path, headers: { 'x-twilio-signature': 'forged' } }, realChecks), null, 'bad signature');
  const noToken = '/twilio/relay';
  assert.equal(authoriseUpgrade({ url: noToken, headers: { 'x-twilio-signature': wsSign(noToken) } }, realChecks), null, 'signed but no token');
  const badToken = '/twilio/relay?token=v1.abc.def';
  assert.equal(authoriseUpgrade({ url: badToken, headers: { 'x-twilio-signature': wsSign(badToken) } }, realChecks), null, 'signed but forged token');
  const other = `/elsewhere?token=${encodeURIComponent(tokenFor())}`;
  assert.equal(authoriseUpgrade({ url: other, headers: { 'x-twilio-signature': wsSign(other) } }, realChecks), null, 'wrong path');
});

class FakeSocket implements RelaySocket {
  readyState = 1;
  sent: any[] = [];
  closed: [number?, string?] | null = null;
  private handlers: Record<string, Array<(arg?: unknown) => void>> = {};
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code?: number, reason?: string) { this.closed = [code, reason]; this.emit('close'); }
  on(event: string, handler: (arg?: unknown) => void) { (this.handlers[event] ??= []).push(handler); return this as any; }
  emit(event: string, arg?: unknown) { for (const handler of this.handlers[event] ?? []) handler(arg); }
}

function fakeSession(replies: Array<{ reply: string; endCall: boolean }>, started = true) {
  const calls = { prompts: [] as string[], finishes: 0 };
  const session = {
    start: async () => started,
    handleCallerText: async (text: string) => { calls.prompts.push(text); return replies.shift()!; },
    finish: async () => { calls.finishes += 1; },
  } as unknown as CallSession;
  return { session, calls };
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test('caller speech is answered and the call ends after the goodbye', async () => {
  const ws = new FakeSocket();
  const { session, calls } = fakeSession([{ reply: 'Which suburb?', endCall: false }, { reply: 'Thanks, bye.', endCall: true }]);
  const completed: string[] = [];
  runCall(ws, { businessId: BIZ_A, callSid: sid('a') }, { createSession: () => session, complete: async (s) => { completed.push(s); } });
  ws.emit('message', JSON.stringify({ type: 'setup', callSid: sid('a') }));
  ws.emit('message', JSON.stringify({ type: 'prompt', voicePrompt: 'Leaking tap', last: true }));
  await tick(5);
  assert.deepEqual(ws.sent, [{ type: 'text', token: 'Which suburb?', last: true }]);
  ws.emit('message', JSON.stringify({ type: 'prompt', voicePrompt: 'partial', last: false }));
  ws.emit('message', 'not json');
  ws.emit('message', JSON.stringify({ type: 'prompt', voicePrompt: 'Newtown', last: true }));
  await tick(400);
  assert.deepEqual(calls.prompts, ['Leaking tap', 'Newtown'], 'partial prompts and junk are ignored');
  assert.deepEqual(ws.sent.slice(1), [{ type: 'text', token: 'Thanks, bye.', last: true }, { type: 'end' }]);
  ws.emit('close');
  ws.emit('error');
  await tick(5);
  assert.equal(calls.finishes, 1);
  assert.deepEqual(completed, [sid('a')], 'the call is completed exactly once');
});

test('a socket whose setup names a different call is closed', async () => {
  const ws = new FakeSocket();
  const { session, calls } = fakeSession([]);
  const completed: string[] = [];
  runCall(ws, { businessId: BIZ_A, callSid: sid('a') }, { createSession: () => session, complete: async (s) => { completed.push(s); } });
  ws.emit('message', JSON.stringify({ type: 'setup', callSid: sid('b') }));
  await tick(5);
  assert.equal(ws.closed?.[0], 1008);
  assert.deepEqual(calls.prompts, []);
  assert.deepEqual(completed, [sid('a')], 'only the call named in the token is touched');
});

test('if the business cannot be loaded the caller hears an apology and the call ends', async () => {
  const ws = new FakeSocket();
  const { session } = fakeSession([], false);
  runCall(ws, { businessId: BIZ_A, callSid: sid('a') }, { createSession: () => session, complete: async () => undefined });
  ws.emit('message', JSON.stringify({ type: 'setup', callSid: sid('a') }));
  await tick(400);
  assert.match(ws.sent[0].token, /can't take your call right now/);
  assert.deepEqual(ws.sent[1], { type: 'end' });
});
