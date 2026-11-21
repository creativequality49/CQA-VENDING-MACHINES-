import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { z } from 'zod';

const source = fs.readFileSync('app/api/marketplace/checkout/route.ts', 'utf8');
const compiled = ts.transpileModule(source.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/export /g, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
}).outputText;
const readinessJs = ts.transpileModule(fs.readFileSync('lib/cqa-offer-readiness.ts', 'utf8').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const readiness = new Function(readinessJs + ';return getCqaOfferCheckoutHold;')();
for (const variant of [
  { offerType: 'digital_product', fulfillmentType: 'none' },
  { offerType: 'service', fulfillmentType: 'digital' },
  { offerType: 'digital_product', fulfillmentType: 'digital' }
]) {
  let stripeCalls = 0;
  const tables = [];
  const context = { offer_type: variant.offerType, business_id: 'business', offer_id: '00000000-0000-4000-8000-000000000001', machine_slug: 'test' };
  const post = new Function('getCqaOfferCheckoutHold', 'NextResponse', 'z', 'getPublicSupabaseClient', 'getCqaSupabaseAdmin', 'getStripeClient', 'isCqaDigitalCheckoutAllowed', compiled + ';return POST;')(
    readiness, { json: (body, options) => ({ body, status: options?.status || 200 }) }, z,
    () => ({ rpc: async () => ({ data: context, error: null }) }),
    () => ({ from(table) { tables.push(table); const query = { select() { return query; }, eq() { return query; },
      maybeSingle: async () => ({ data: { offer_type: variant.offerType, fulfillment_type: variant.fulfillmentType, fulfillment_config: { deliveryDescription: 'Report', deliveryTiming: 'Three days', supportDetails: 'Email support', refundTerms: 'Refund before work' } }, error: null }) }; return query; } }),
    () => { stripeCalls++; throw Error('Provider must never be touched for unavailable digital delivery'); }, () => false
  );
  const response = await post(new Request('https://example.test/api/marketplace/checkout', {
    method: 'POST', body: JSON.stringify({ machineSlug: 'test', offerId: '00000000-0000-4000-8000-000000000001' })
  }));
  assert.equal(response.status, 409);
  assert.match(response.body.error, /Protected digital delivery/);
  assert.equal(stripeCalls, 0);
  assert.deepEqual(tables, ['cqa_offers']);
  console.log(`PASS ${variant.offerType}/${variant.fulfillmentType} blocked before Stripe or billing writes`);
}

// Public storefront image storage must never be mistaken for a paid download.
const storageSchema = fs.readFileSync('database/cqa_business_in_box.sql', 'utf8');
assert.match(storageSchema, /'cqa-machine-media',\s*'cqa-machine-media',\s*true/);
assert.doesNotMatch(fs.readFileSync('app/api/signed-download/route.ts', 'utf8'), /cqa-machine-media|public_url|fulfillment_config/);
assert.match(fs.readFileSync('lib/storage.ts', 'utf8'), /GetObjectCommand/);
assert.match(fs.readFileSync('app/api/signed-download/route.ts', 'utf8'), /hasEntitlement\(session.user.id, productId\)/);
console.log('PASS public machine images are excluded from protected paid download resolution');
