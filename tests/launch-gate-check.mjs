import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { z } from 'zod';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const allowed = new Function('process', compile('lib/cqa-launch-gate.ts') + ';return isNewCqaCheckoutAllowed;');
for (const test of [
  { key: 'sk_live_example', expected: false }, { key: 'rk_live_example', expected: false },
  { key: undefined, expected: false }, { key: 'unknown', expected: false },
  { key: 'sk_test_example', expected: true }, { key: 'rk_test_example', expected: true }, { key: 'rkcs_test_example', expected: true },
  { key: 'sk_live_example', flag: 'true', expected: true },
  { key: 'sk_live_example', flag: 'TRUE', expected: false }, { key: 'sk_live_example', flag: 'false', expected: false }
]) {
  assert.equal(allowed({ env: { STRIPE_SECRET_KEY: test.key, CQA_CUSTOMER_LAUNCH_APPROVED: test.flag } })(), test.expected);
}
console.log('PASS launch flag and live/test/missing/unknown credential matrix (10 cases)');
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
