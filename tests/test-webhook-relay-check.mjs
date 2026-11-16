import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
const source = fs.readFileSync('supabase/functions/cqa-test-webhook/index.ts', 'utf8');
const compiled = ts.transpileModule(source.replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const now = 1800000000000;
const origin = 'https://cqa-vending-machines-fixture-creativequality.vercel.app';
const rpc = 'https://ndzmlywsuywkhgqdbzft.supabase.co/rest/v1/rpc/cqa_test_webhook_config';
const secret = 'whsec_' + 's'.repeat(32);
const bypass = 'B'.repeat(32);
const raw = new TextEncoder().encode('{"type":"checkout.session.completed","livemode":false,"data":{"value":"é"}}');
const env = { SUPABASE_URL: 'https://ndzmlywsuywkhgqdbzft.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-service-role-fixture' };
const config = { preview_origin: origin, protection_bypass: bypass, stripe_signing_secret: secret };
async function signature(bytes = raw, timestamp = Math.floor(now / 1000), signingSecret = secret) {
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(signingSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const signed = new Uint8Array(prefix.length + bytes.length); signed.set(prefix); signed.set(bytes, prefix.length);
  const hex = Buffer.from(await webcrypto.subtle.sign('HMAC', key, signed)).toString('hex');
  return `t=${timestamp},v1=${hex}`;
}
function harness(options = {}) {
  const calls = [];
  let serve;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url === rpc) {
      if (options.rpcThrow) throw Error('private RPC failure');
      return new Response(options.rpcBody ?? JSON.stringify(options.config || config), { status: options.rpcStatus || 200 });
    }
    if (options.forwardThrow) throw Error('private forward failure');
    if (options.forwardTimeout) throw new DOMException('private timeout detail', 'TimeoutError');
    return new Response('private app response', { status: options.forwardStatus || 200, headers: { location: 'https://private.test', 'set-cookie': 'private-cookie' } });
  };
  new Function('Deno', 'fetch', 'crypto', 'Date', compiled)({ env: { get: key => (options.env || env)[key] }, serve: handler => { serve = handler; } }, fetch, webcrypto, { now: () => now });
  return { calls, handle: request => serve(request) };
}
async function request(route = 'platform', options = {}) {
  return new Request(`https://ndzmlywsuywkhgqdbzft.supabase.co/functions/v1/cqa-test-webhook/${route}`, {
    method: options.method || 'POST', headers: { 'stripe-signature': options.signature ?? await signature(), ...options.headers },
    ...((options.method || 'POST') === 'POST' ? { body: options.body ?? raw, duplex: 'half' } : {})
  });
}
async function test(name, fn) { await fn(); console.log('PASS ' + name); }
await test('valid fresh raw-body signature forwards only fixed paths and secret header, sanitizes response', async () => {
  for (const [route, path] of [['platform', '/api/stripe/webhook'], ['connect', '/api/marketplace/stripe-webhook']]) {
    const h = harness(); const req = await request(route, { headers: { authorization: 'caller-controlled', 'x-vercel-protection-bypass': 'caller-controlled', 'x-target-url': 'https://evil.test' } });
    const result = await h.handle(req); assert.equal(result.status, 204); assert.equal(await result.text(), '');
    assert.equal(h.calls.length, 2); assert.equal(h.calls[0].url, rpc);
    assert.deepEqual(JSON.parse(h.calls[0].init.body), { p_route: route });
    assert.equal(h.calls[0].init.headers.Authorization, 'Bearer private-service-role-fixture');
    const forwarded = h.calls[1]; assert.equal(forwarded.url, origin + path); assert.doesNotMatch(forwarded.url, /bypass|BBBB/);
    assert.equal(forwarded.init.redirect, 'error'); assert.ok(forwarded.init.signal instanceof AbortSignal);
    assert.equal(forwarded.init.headers['x-vercel-protection-bypass'], bypass);
    assert.equal(forwarded.init.headers['stripe-signature'], req.headers.get('stripe-signature'));
    assert.deepEqual(new Uint8Array(forwarded.init.body), raw); assert.equal(forwarded.init.headers.authorization, undefined);
    assert.equal(result.headers.get('location'), null); assert.equal(result.headers.get('set-cookie'), null);
  }
});
await test('unknown routes, query controls and non-POST methods never read configuration or forward', async () => {
  for (const route of ['platform/extra', 'other', 'platform?destination=https://evil.test', '../platform']) {
    const h = harness(); assert.equal((await h.handle(await request(route))).status, 404); assert.equal(h.calls.length, 0);
  }
  const h = harness(); assert.equal((await h.handle(await request('platform', { method: 'GET' }))).status, 405); assert.equal(h.calls.length, 0);
});
await test('wrong/malformed project URL and missing privileged key never contact any provider', async () => {
  for (const value of ['', undefined, 'https://rjxiuukphwybujuclenn.supabase.co', env.SUPABASE_URL + '.evil.test', env.SUPABASE_URL + '/path']) {
    const h = harness({ env: { ...env, SUPABASE_URL: value } }); assert.equal((await h.handle(await request())).status, 503); assert.equal(h.calls.length, 0);
  }
  const h = harness({ env: { ...env, SUPABASE_SERVICE_ROLE_KEY: '' } }); assert.equal((await h.handle(await request())).status, 503); assert.equal(h.calls.length, 0);
});
await test('missing, malformed, stale and future signatures fail before configuration lookup', async () => {
  for (const value of ['', 'v1=abcd', 't=1,v1=' + 'a'.repeat(64), await signature(raw, now / 1000 - 301), await signature(raw, now / 1000 + 301), (await signature()) + ',t=' + now / 1000]) {
    const h = harness(); assert.equal((await h.handle(await request('platform', { signature: value }))).status, 401); assert.equal(h.calls.length, 0);
  }
});
await test('tampered bytes and wrong route signing key never forward; rotation accepts a valid v1 signature', async () => {
  for (const opts of [{ body: new TextEncoder().encode('tampered') }, { signature: await signature(raw, now / 1000, 'whsec_wrong') }]) {
    const h = harness(); assert.equal((await h.handle(await request('platform', opts))).status, 401); assert.equal(h.calls.length, 1);
  }
  const h = harness(); assert.equal((await h.handle(await request('platform', { signature: (await signature()) + ',v1=' + '0'.repeat(64) }))).status, 204);
  const connect = harness({ config: { ...config, stripe_signing_secret: 'whsec_' + 'c'.repeat(32) } });
  assert.equal((await connect.handle(await request('connect'))).status, 401); assert.equal(connect.calls.length, 1);
});
await test('signed live, missing-mode and malformed events cannot reach isolated test app', async () => {
  for (const text of ['{"livemode":true}', '{}', 'not json']) {
    const body = new TextEncoder().encode(text); const h = harness();
    assert.equal((await h.handle(await request('platform', { body, signature: await signature(body) }))).status, 400); assert.equal(h.calls.length, 1);
  }
});
await test('declared and streamed bodies over 1MiB are bounded before RPC', async () => {
  for (const opts of [{ headers: { 'content-length': String(1024 * 1024 + 1) } }, { headers: { 'content-length': 'bad' } }, { body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(600000)); controller.enqueue(new Uint8Array(600000)); controller.close(); } }) }]) {
    const h = harness(); assert.equal((await h.handle(await request('platform', opts))).status, 413); assert.equal(h.calls.length, 0);
  }
  const body = new TextEncoder().encode(JSON.stringify({ livemode: false, padding: ' '.repeat(1024 * 1024 - 31) })); assert.equal(body.byteLength, 1024 * 1024); const h = harness(); assert.equal((await h.handle(await request('platform', { body, signature: await signature(body) }))).status, 204);
});
await test('Vault configuration rejects credentials, ports, paths, queries, wrong hosts and newline keys', async () => {
  for (const value of ['https://evil.test', origin + '/', origin + ':443', origin + '/api', origin + '?x=1', origin.replace('https://', 'https://user:pass@'), origin + '\n']) {
    const h = harness({ config: { ...config, preview_origin: value } }); assert.equal((await h.handle(await request())).status, 503); assert.equal(h.calls.length, 1);
  }
  for (const overrides of [{ protection_bypass: bypass + '\n' }, { protection_bypass: '' }, { stripe_signing_secret: secret + '\n' }, { stripe_signing_secret: '' }]) {
    const h = harness({ config: { ...config, ...overrides } }); assert.equal((await h.handle(await request())).status, 503); assert.equal(h.calls.length, 1);
  }
});
await test('RPC/provider errors, redirects, timeouts and app failure expose only generic error status', async () => {
  for (const options of [{ rpcThrow: true }, { rpcStatus: 403 }, { rpcBody: 'private invalid json' }, { forwardThrow: true }, { forwardTimeout: true }, { forwardStatus: 302 }, { forwardStatus: 500 }, { rpcBody: 'x'.repeat(17000) }]) {
    const h = harness(options); const result = await h.handle(await request()); assert.ok([502, 503].includes(result.status));
    assert.doesNotMatch(await result.text(), /private|whsec|BBBB|supabase|vercel/);
  }
});
const sql = fs.readFileSync('database/cqa_test_webhook_relay_provisioning.sql', 'utf8');
assert.match(sql, /security definer\s+set search_path = pg_catalog/i);
assert.match(sql, /revoke all on function public\.cqa_test_webhook_config\(text\) from public, anon, authenticated/i);
assert.match(sql, /grant execute on function public\.cqa_test_webhook_config\(text\) to service_role/i);
assert.match(sql, /vault\.decrypted_secrets/);
assert.doesNotMatch(sql, /create_secret\(/i);
assert.match(fs.readFileSync('supabase/config.toml', 'utf8'), /\[functions\.cqa-test-webhook\]\s*verify_jwt = false/);
console.log('PASS provisioning source limits RPC execution to service_role and uses encrypted Vault; JWT gateway disabled only for this signed receiver');
