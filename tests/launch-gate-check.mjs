import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { z } from 'zod';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const gateFactory = new Function('process', compile('lib/cqa-launch-gate.ts') + ';return { isNewCqaCheckoutAllowed, isCqaDigitalCheckoutAllowed };');
const testProject = 'ndzmlywsuywkhgqdbzft';
const isolated = { VERCEL_ENV: 'preview', CQA_COMMERCE_TEST_PROJECT: testProject,
  SUPABASE_URL: `https://${testProject}.supabase.co`, NEXT_PUBLIC_SUPABASE_URL: `https://${testProject}.supabase.co` };
let cases = 0;
function check(env, checkout, digital = checkout) {
  const gates = gateFactory({ env });
  assert.equal(gates.isNewCqaCheckoutAllowed(), checkout, JSON.stringify(env));
  assert.equal(gates.isCqaDigitalCheckoutAllowed(), digital, JSON.stringify(env));
  cases++;
}
for (const prefix of ['sk_test_', 'rk_test_', 'rkcs_test_']) {
  const base = { ...isolated, STRIPE_SECRET_KEY: prefix + 'example' };
  check(base, true);
  check({ ...base, SUPABASE_URL: base.SUPABASE_URL + '/', NEXT_PUBLIC_SUPABASE_URL: base.NEXT_PUBLIC_SUPABASE_URL + '/' }, true);
  for (const VERCEL_ENV of [undefined, 'production', 'development', 'Preview']) {
    check({ ...base, VERCEL_ENV }, false);
    check({ ...base, VERCEL_ENV, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, false);
  }
  for (const CQA_COMMERCE_TEST_PROJECT of [undefined, 'rjxiuukphwybujuclenn', 'yes']) check({ ...base, CQA_COMMERCE_TEST_PROJECT }, false);
  for (const field of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
    for (const value of [undefined, '', 'https://rjxiuukphwybujuclenn.supabase.co', 'http://' + testProject + '.supabase.co',
      `https://${testProject}.supabase.co.evil.test`, `https://user:password@${testProject}.supabase.co`,
      `https://${testProject}.supabase.co:443`, `https://${testProject}.supabase.co/path`,
      `https://${testProject}.supabase.co?x=1`, `https://${testProject}.supabase.co/#fragment`, ' ' + base[field]]) {
      check({ ...base, [field]: value }, false);
      check({ ...base, [field]: value, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, false);
    }
  }
}
for (const prefix of ['sk_live_', 'rk_live_', 'rkcs_live_']) {
  const base = { STRIPE_SECRET_KEY: prefix + 'example', VERCEL_ENV: 'production' };
  check(base, false);
  check({ ...base, CQA_CUSTOMER_LAUNCH_APPROVED: 'true' }, true, false);
  check({ ...base, CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, false);
  check({ ...base, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, true);
  for (const VERCEL_ENV of [undefined, 'preview', 'development', 'Production']) {
    check({ ...base, VERCEL_ENV, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, false);
  }
  for (const flag of ['TRUE', 'false', '', undefined]) check({ ...base, CQA_CUSTOMER_LAUNCH_APPROVED: flag, CQA_DIGITAL_DELIVERY_APPROVED: flag }, false);
}
for (const key of [undefined, '', 'unknown', 'sk_test_', 'sk_live_', 'sk_test_bad key', 'sk_live_example\n']) {
  check({ ...isolated, STRIPE_SECRET_KEY: key }, false);
  check({ ...isolated, STRIPE_SECRET_KEY: key, CQA_CUSTOMER_LAUNCH_APPROVED: 'true', CQA_DIGITAL_DELIVERY_APPROVED: 'true' }, false);
}
console.log(`PASS sandbox isolation, live approvals and malformed-key matrix (${cases} cases; both gates checked)`);
for (const kind of ['plan', 'worker']) {
  const post = new Function('NextResponse', 'z', 'isNewCqaCheckoutAllowed', 'CQA_PRELAUNCH_CHECKOUT_MESSAGE', compile('app/api/cqa-billing/checkout/route.ts') + ';return POST;')(
    { json: (body, options) => ({ body, status: options?.status || 200 }) }, z, () => false, 'Payments paused'
  );
  const response = await post(new Request('https://example.test/checkout', { method: 'POST', headers: { authorization: 'Bearer test' },
    body: JSON.stringify({ kind, businessId: '00000000-0000-4000-8000-000000000001', ...(kind === 'plan' ? { plan: 'starter' } : { workerId: 'sales' }) }) }));
  assert.equal(response.status, 503); assert.equal(response.body.code, 'CQA_LAUNCH_PENDING');
  console.log(`PASS new ${kind} checkout blocked before any provider or database call`);
}
let providerCalls = 0;
const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: { fulfillment_type: 'service' }, error: null }) };
const marketplacePost = new Function('NextResponse', 'z', 'isNewCqaCheckoutAllowed', 'CQA_PRELAUNCH_CHECKOUT_MESSAGE', 'getPublicSupabaseClient', 'getCqaSupabaseAdmin', 'getStripeClient', compile('app/api/marketplace/checkout/route.ts') + ';return POST;')(
  { json: (body, options) => ({ body, status: options?.status || 200 }) }, z, () => false, 'Payments paused',
  () => ({ rpc: async () => ({ data: { offer_type: 'service', business_id: 'business', offer_id: 'offer' }, error: null }) }),
  () => ({ from: () => query }), () => { providerCalls++; throw Error('Stripe must not run'); }
);
const response = await marketplacePost(new Request('https://example.test/checkout', { method: 'POST', body: JSON.stringify({ machineSlug: 'test', offerId: '00000000-0000-4000-8000-000000000001' }) }));
assert.equal(response.status, 503); assert.equal(response.body.code, 'CQA_LAUNCH_PENDING'); assert.equal(providerCalls, 0);
console.log('PASS new storefront service checkout blocked before Stripe');
for (const sellable of [false, true]) {
  const catalogPost = new Function('NextResponse', 'requireUserSession', 'getProductById', 'getProductReadiness', 'isNewCqaCheckoutAllowed', 'CQA_PRELAUNCH_CHECKOUT_MESSAGE', 'getStripeClient', compile('app/api/stripe/checkout/route.ts') + ';return POST;')(
    { json: (body, options) => ({ body, status: options?.status || 200 }) }, async () => ({ user: { id: 'buyer' } }),
    () => ({ id: 'product' }), () => ({ sellable, checks: {} }), () => false, 'Payments paused',
    () => { throw Error('Catalog Stripe must not run'); }
  );
  const result = await catalogPost(new Request('https://example.test/checkout', { method: 'POST', body: JSON.stringify({ productId: 'product', machineSlug: 'store' }) }));
  assert.equal(result.status, sellable ? 503 : 409);
  if (sellable) assert.equal(result.body.code, 'CQA_LAUNCH_PENDING');
}
console.log('PASS catalogue readiness and launch approval both required before Stripe');
for (const path of ['app/api/cqa-billing/portal/route.ts', 'app/api/stripe/webhook/route.ts', 'app/api/marketplace/stripe-webhook/route.ts']) {
  assert.doesNotMatch(fs.readFileSync(path, 'utf8'), /isNewCqaCheckoutAllowed/);
}
console.log('PASS account management and signed fulfillment remain independent of new-payment gate');
