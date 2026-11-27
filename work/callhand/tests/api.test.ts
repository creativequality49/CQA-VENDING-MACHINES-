import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import http from 'node:http';
import test from 'node:test';
import { createApp } from '../server/app';
import type { Chat } from '../server/calls/openai';
import { BIZ_A, FakeDb, sid } from './fakeDb';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STAFF = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NEWBIE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CALL_ID = '33333333-3333-4333-8333-333333333333';

const SETTINGS = {
  business_id: BIZ_A, enabled: false, assistant_name: 'Sam', greeting: 'Thanks for calling Alpha Plumbing.', about: '', services: '',
  service_area: '', hours: '', pricing_wording: 'The team will give you a price once they know more.', callback_window: 'within the hour',
  emergency_instructions: '', owner_alert_number: null,
};

function seed() {
  const db = new FakeDb({
    business_members: [{ business_id: BIZ_A, user_id: OWNER, role: 'owner' }, { business_id: BIZ_A, user_id: STAFF, role: 'staff' }],
    businesses: [{ id: BIZ_A, name: 'Alpha Plumbing', timezone: 'Australia/Sydney' }],
    receptionist_settings: [{ ...SETTINGS }],
    phone_numbers: [],
    calls: [
      { id: CALL_ID, business_id: BIZ_A, call_sid: sid('a'), started_at: '2026-11-08T01:00:00Z', job_type: 'Burst pipe', handled_at: null, transcript: [{ role: 'caller', text: 'help' }] },
      { id: '44444444-4444-4444-8444-444444444444', business_id: BIZ_A, call_sid: sid('b'), started_at: '2026-11-08T02:00:00Z', job_type: 'Leak', handled_at: '2026-11-08T03:00:00Z' },
    ],
    alert_deliveries: [{ business_id: BIZ_A, call_id: CALL_ID, status: 'sent', detail: null, sent_at: '2026-11-08T01:05:00Z', recipient: '+61400000001' }],
  });
  db.rpcs.create_business = ({ p_name }) => {
    db.rows('businesses').push({ id: 'new-biz', name: p_name });
    return { data: 'new-biz', error: null };
  };
  return db;
}

async function withApi(db: FakeDb, fn: (call: (method: string, path: string, user?: string | null, body?: unknown) => Promise<{ status: number; json: any }>) => Promise<void>, options: { serverMissing?: string[]; chat?: Chat | null } = {}) {
  const app = createApp({
    staticDir: null,
    api: {
      // Tokens in tests are just user ids; Supabase verifies real ones.
      auth: { verify: async (token) => (token.startsWith('bad') ? null : token), dbFor: () => db.client() },
      serverMissing: () => options.serverMissing ?? [],
      chat: () => options.chat ?? null,
    },
  });
  const server = http.createServer(app).listen(0);
  const port = (server.address() as AddressInfo).port;
  const call = async (method: string, path: string, user: string | null = OWNER, body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(user ? { authorization: `Bearer ${user}` } : {}) },
      body: body === undefined || method === 'GET' ? undefined : JSON.stringify(body),
    });
    return { status: response.status, json: await response.json() };
  };
  try { await fn(call); } finally { server.close(); }
}

test('everything except health needs a signed-in user', async () => {
  await withApi(seed(), async (call) => {
    assert.equal((await call('GET', '/health', null)).status, 200);
    for (const [method, path] of [['GET', '/me'], ['GET', '/calls'], ['PUT', '/settings'], ['POST', '/try']]) {
      assert.equal((await call(method, path, null, {})).status, 401, `${method} ${path}`);
    }
    assert.equal((await call('GET', '/me', 'bad-token')).status, 401);
  });
});

test('a new user has no business until they create one', async () => {
  const db = seed();
  await withApi(db, async (call) => {
    assert.deepEqual((await call('GET', '/me', NEWBIE)).json, { business: null });
    assert.equal((await call('GET', '/calls', NEWBIE)).status, 409);
    assert.equal((await call('POST', '/business', NEWBIE, { name: 'x' })).status, 400);
    const created = await call('POST', '/business', NEWBIE, { name: 'Charlie Roofing' });
    assert.equal(created.status, 201);
    assert.equal(db.rows('businesses').at(-1)!.name, 'Charlie Roofing');
    assert.equal((await call('POST', '/business', OWNER, { name: 'Second' })).status, 409, 'one business per account');
  });
});

test('the owner sees their settings and a go-live checklist', async () => {
  await withApi(seed(), async (call) => {
    const me = (await call('GET', '/me')).json;
    assert.equal(me.business.name, 'Alpha Plumbing');
    assert.equal(me.business.role, 'owner');
    assert.equal(me.settings.assistant_name, 'Sam');
    assert.deepEqual(me.phoneNumbers, []);
    assert.equal(me.checklist.ok, false);
    assert.deepEqual(me.checklist.items.filter((i: any) => !i.done).map((i: any) => i.key), ['phone_number', 'owner_alert_number', 'business_info', 'server']);
  }, { serverMissing: ['OpenAI key'] });
});

test('settings are validated and the mobile number is stored in international format', async () => {
  const db = seed();
  await withApi(db, async (call) => {
    const base = { ...SETTINGS, business_id: undefined };
    delete (base as any).business_id;
    const priced = await call('PUT', '/settings', OWNER, { ...base, pricing_wording: 'Call-outs are $99 plus parts.' });
    assert.equal(priced.status, 400);
    assert.equal(priced.json.field, 'pricing_wording');
    const badMobile = await call('PUT', '/settings', OWNER, { ...base, owner_alert_number: '12345' });
    assert.equal(badMobile.status, 400);
    assert.match(badMobile.json.message, /0412 345 678/);
    const extra = await call('PUT', '/settings', OWNER, { ...base, business_id: 'someone-else' });
    assert.equal(extra.status, 400, 'unknown fields such as business_id are rejected');
    const ok = await call('PUT', '/settings', OWNER, { ...base, owner_alert_number: '0412 345 678', hours: 'Mon-Fri 7-5' });
    assert.equal(ok.status, 200);
    assert.equal(db.rows('receptionist_settings')[0].owner_alert_number, '+61412345678');
    assert.equal(db.rows('receptionist_settings')[0].hours, 'Mon-Fri 7-5');
    assert.equal((await call('PUT', '/settings', STAFF, base)).status, 403, 'staff cannot change settings');
  });
});

test('answering cannot be switched on until the checklist is complete', async () => {
  const db = seed();
  const ready = { ...SETTINGS, enabled: true, owner_alert_number: '0412 345 678', about: 'Plumbers' } as any;
  delete ready.business_id;
  await withApi(db, async (call) => {
    const blocked = await call('PUT', '/settings', OWNER, ready);
    assert.equal(blocked.status, 409);
    assert.match(blocked.json.message, /callhand phone number/);
    assert.equal(db.rows('receptionist_settings')[0].enabled, false);
    db.rows('phone_numbers').push({ business_id: BIZ_A, phone_number: '+61255550101', active: true });
    const allowed = await call('PUT', '/settings', OWNER, ready);
    assert.equal(allowed.status, 200);
    assert.equal(db.rows('receptionist_settings')[0].enabled, true);
  });
  await withApi(seed(), async (call) => {
    const db2Blocked = await call('PUT', '/settings', OWNER, ready);
    assert.match(db2Blocked.json.message, /callhand service/);
  }, { serverMissing: ['OpenAI key'] });
});

test('calls are listed for the user\'s own business, newest first, with an open filter', async () => {
  const db = seed();
  await withApi(db, async (call) => {
    const all = (await call('GET', '/calls')).json.calls;
    assert.deepEqual(all.map((c: any) => c.job_type), ['Leak', 'Burst pipe']);
    const open = (await call('GET', '/calls?filter=open')).json.calls;
    assert.deepEqual(open.map((c: any) => c.job_type), ['Burst pipe']);
    const listQuery = db.log.filter((entry) => entry.table === 'calls' && entry.op === 'select').at(-1)!;
    assert.ok(listQuery.filters.includes(`business_id=${BIZ_A}`), 'scoped to the membership business, not a request field');

    const detail = (await call('GET', `/calls/${CALL_ID}`)).json;
    assert.equal(detail.call.job_type, 'Burst pipe');
    assert.deepEqual(detail.call.transcript, [{ role: 'caller', text: 'help' }]);
    assert.equal(detail.alert.status, 'sent');
    assert.equal((await call('GET', '/calls/not-a-uuid')).status, 404);
    assert.equal((await call('GET', '/calls/99999999-9999-4999-8999-999999999999')).status, 404);
  });
});

test('any team member can mark a call handled and undo it', async () => {
  const db = seed();
  await withApi(db, async (call) => {
    const done = await call('POST', `/calls/${CALL_ID}/handled`, STAFF, { handled: true });
    assert.equal(done.status, 200);
    assert.ok(db.rows('calls')[0].handled_at);
    await call('POST', `/calls/${CALL_ID}/handled`, OWNER, { handled: false });
    assert.equal(db.rows('calls')[0].handled_at, null);
    assert.equal((await call('POST', `/calls/${CALL_ID}/handled`, OWNER, { handled: 'yes' })).status, 400);
  });
});

test('"try it" runs the real engine, keeps a conversation, and saves nothing', async () => {
  const db = seed();
  const chat: Chat = async (messages) => {
    const last = messages.at(-1)!;
    if (last.role === 'user' && last.content === 'Leaking tap in Newtown') {
      return { content: null, toolCalls: [{ id: 't1', type: 'function', function: { name: 'save_job_details', arguments: '{"job_type":"Leaking tap","suburb":"Newtown"}' } }] };
    }
    if (last.role === 'tool') return { content: 'Got it. What is your name?', toolCalls: [] };
    return { content: `Turn ${messages.filter((m) => m.role === 'user').length}`, toolCalls: [] };
  };
  await withApi(db, async (call) => {
    const first = await call('POST', '/try', OWNER, { message: 'Leaking tap in Newtown' });
    assert.equal(first.status, 200);
    assert.match(first.json.greeting, /You're speaking with Sam, the AI receptionist/);
    assert.equal(first.json.reply, 'Got it. What is your name?');
    assert.deepEqual(first.json.captured, { job_type: 'Leaking tap', suburb: 'Newtown' });
    assert.equal(first.json.aiReady, true);
    const second = await call('POST', '/try', OWNER, { sessionId: first.json.sessionId, message: 'Alice' });
    assert.equal(second.json.sessionId, first.json.sessionId);
    assert.equal(second.json.greeting, null);
    assert.equal(second.json.reply, 'Turn 2', 'history carried over');
    const stolen = await call('POST', '/try', STAFF, { sessionId: first.json.sessionId, message: 'hi' });
    assert.notEqual(stolen.json.sessionId, first.json.sessionId, "another user cannot continue someone else's test");
    assert.equal(db.rows('calls').length, 2, 'no calls were created');
  }, { chat });
});

test('"try it" is rate limited', async () => {
  await withApi(seed(), async (call) => {
    let last = 0;
    for (let i = 0; i < 21; i += 1) last = (await call('POST', '/try', STAFF, { message: `hi ${i}` })).status;
    assert.equal(last, 429);
  });
});

test('security headers are set on every response', async () => {
  const app = createApp({ staticDir: null, api: { auth: { verify: async () => null, dbFor: () => seed().client() }, serverMissing: () => [], chat: () => null } });
  const server = http.createServer(app).listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/health`);
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(response.headers.get('x-powered-by'), null);
  } finally {
    server.close();
  }
});
