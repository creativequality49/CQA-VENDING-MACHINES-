import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { getCqaPreviewIsolationDiagnostics } from '../lib/cqa-preview-isolation.ts';
import { requireCqaSupabaseUrl } from '../lib/cqa-supabase-config.ts';

const source = readFileSync(new URL('../app/api/health/route.ts', import.meta.url), 'utf8');
const loadRoute = new Function('process', 'fetch', 'NextResponse', 'getPublicSupabaseClient',
  'getCqaSupabaseAdmin', 'getCqaPreviewIsolationDiagnostics', 'requireCqaSupabaseUrl',
  'getStripeKeyConfigurationStatus', 'getCqaChatProvider', 'getCqaEmbeddingProvider',
  stripTypeScriptTypes(source.replace(/^import .*;$/gm, '').replace(/^export /gm, '')) + '\nreturn GET;');
const testOrigin = 'https://ndzmlywsuywkhgqdbzft.supabase.co';
const otherOrigin = 'https://other-project.supabase.co';
const env = {
  VERCEL_ENV: 'preview', SUPABASE_URL: testOrigin, NEXT_PUBLIC_SUPABASE_URL: testOrigin,
  CQA_COMMERCE_TEST_PROJECT: 'ndzmlywsuywkhgqdbzft', STRIPE_SECRET_KEY: 'sk_test_' + 'x'.repeat(20),
  R2_ACCOUNT_ID: 'fixture', R2_ACCESS_KEY_ID: 'fixture', R2_SECRET_ACCESS_KEY: 'fixture', R2_BUCKET: 'fixture',
  RESEND_API_KEY: 'fixture', CQA_EMAIL_FROM: 'sender@example.test', STRIPE_WEBHOOK_SECRET: 'fixture',
  STRIPE_CONNECT_WEBHOOK_SECRET: 'fixture'
};
const client = () => ({ from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }) });
const goodGuard = () => new Response('Invalid signature', { status: 401 });
const testRoutes = ['platform', 'connect'].map(route => testOrigin + '/functions/v1/cqa-test-webhook/' + route);

async function getHealth({ config = {}, respond = goodGuard, account = 'acct_1UPzM6P6kjGSpjgk' } = {}) {
  const calls = [];
  const request = (url, options) => {
    calls.push({ url, options });
    return respond(url);
  };
  const diagnose = values => getCqaPreviewIsolationDiagnostics(values, async () => Response.json({ id: account }));
  const get = loadRoute({ env: { ...env, ...config } }, request, Response, client, client,
    diagnose, requireCqaSupabaseUrl, () => 'ok', () => true, () => true);
  const response = await get();
  return { status: response.status, health: await response.json(), calls };
}

const ok = await getHealth();
assert.equal(ok.status, 200);
assert.equal(ok.health.stripeWebhookEdge, 'ok');
assert.deepEqual(ok.calls.map(call => call.url), testRoutes);
for (const { options } of ok.calls) {
  assert.equal(options.method, 'POST');
  assert.equal(options.body, undefined);
  assert.equal(options.headers, undefined);
  assert.equal(options.cache, 'no-store');
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
}
for (const route of testRoutes) {
  for (const failure of [
    () => new Response('Method not allowed', { status: 405 }),
    () => new Response('Missing route', { status: 404 }),
    () => new Response('Gateway authentication required', { status: 401 }),
    () => Response.json({ message: 'Invalid signature' }, { status: 401 }),
    () => { throw new Error('Provider timed out'); }
  ]) {
    const bad = await getHealth({ respond: url => url === route ? failure() : goodGuard() });
    assert.equal(bad.health.stripeWebhookEdge, 'error');
    assert.equal(bad.health.commerceReady, false);
    assert.equal(bad.status, 503);
  }
}
for (const field of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'CQA_COMMERCE_TEST_PROJECT']) {
  const mismatch = await getHealth({ config: { [field]: otherOrigin } });
  assert.equal(mismatch.calls.length, 0);
  assert.equal(mismatch.health.stripeWebhookEdge, 'error');
  assert.equal(mismatch.status, 503);
}
const wrongAccount = await getHealth({ account: 'different-sandbox' });
assert.equal(wrongAccount.health.commerceReady, false);
for (const config of [{ R2_BUCKET: '' }, { R2_PUBLIC_URL: otherOrigin }, { RESEND_API_KEY: '' }]) {
  const missing = await getHealth({ config });
  assert.equal(missing.health.stripeWebhookEdge, 'ok');
  assert.equal(missing.health.launchConfigurationReady, false);
  assert.equal(missing.status, 503);
}
for (const mode of ['production', 'development', 'preview']) {
  const normal = await getHealth({ config: { VERCEL_ENV: mode, SUPABASE_URL: otherOrigin,
    NEXT_PUBLIC_SUPABASE_URL: otherOrigin, CQA_COMMERCE_TEST_PROJECT: '' },
    respond: () => new Response(null, { status: 405 }) });
  assert.deepEqual(normal.calls.map(call => [call.url, call.options.method]),
    [[otherOrigin + '/functions/v1/cqa-stripe-webhook', 'GET']]);
  assert.equal(normal.health.stripeWebhookEdge, 'ok');
}
console.log('PASS isolated Preview webhook routes, signature guards, incomplete isolation, configuration gates and standard deployments');
