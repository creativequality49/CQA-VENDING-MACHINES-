import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const storage = compile('lib/storage.ts');
const config = { R2_ACCOUNT_ID: 'fixture-account', R2_ACCESS_KEY_ID: 'fixture-key', R2_SECRET_ACCESS_KEY: 'fixture-secret', R2_BUCKET: 'fixture-bucket' };
for (const length of [undefined, 0, -1, NaN, 1.5, 1, 500]) {
  let reads = 0, destroyed = 0;
  const verify = new Function('process', 'S3Client', 'HeadObjectCommand', storage + ';return verifyPrivateCatalogAsset;')({ env: config }, class { async send(command) { reads++; assert.deepEqual(command.input, { Bucket: 'fixture-bucket', Key: 'catalog/product.zip' }); return { ContentLength: length }; } destroy() { destroyed++; } }, class { constructor(input) { this.input = input; } });
  assert.equal(await verify('catalog/product.zip'), Number.isSafeInteger(length) && length > 0);
  assert.equal(reads, 1); assert.equal(destroyed, 1);
  for (const key of ['', '../secret', '/root', 'https://public.test/file', 'catalog/file?x=1', 'catalog\\file']) assert.equal(await verify(key), false);
  assert.equal(reads, 1);
}
let cleaned = false;
const unavailable = new Function('process', 'S3Client', 'HeadObjectCommand', storage + ';return verifyPrivateCatalogAsset;')({ env: config }, class { async send() { throw Error('provider details'); } destroy() { cleaned = true; } }, class {});
await assert.rejects(() => unavailable('catalog/product.zip')); assert.equal(cleaned, true);
for (const field of Object.keys(config)) {
  const env = { ...config, [field]: '' };
  const verify = new Function('process', storage + ';return verifyPrivateCatalogAsset;')({ env });
  await assert.rejects(() => verify('catalog/product.zip'), /Missing/);
}
function checkout({ machine = { products: [{ id: 'product' }] }, asset = true, readError = false, allowed = true, ready = true } = {}) {
  let payments = 0, heads = 0;
  const post = new Function('NextResponse', 'requireUserSession', 'getMachine', 'getProductById', 'getProductReadiness', 'isNewCqaCheckoutAllowed', 'CQA_PRELAUNCH_CHECKOUT_MESSAGE', 'verifyPrivateCatalogAsset', 'getCqaSiteUrl', 'getStripeClient', 'process', compile('app/api/stripe/checkout/route.ts') + ';return POST;')(
    { json: (body, options = {}) => ({ body, status: options.status || 200 }) }, async () => ({ user: { id: 'buyer', email: 'buyer@example.test' } }), () => machine,
    () => ({ id: 'product', stripePriceEnv: 'PRICE', assetKey: 'catalog/product.zip', tier: 'basic', version: '1' }), () => ({ sellable: ready }), () => allowed, 'paused',
    async () => { heads++; if (readError) throw Error('private provider error'); return asset; }, () => 'https://site.test', () => ({ checkout: { sessions: { create: async input => { payments++; assert.equal(input.metadata.machineSlug, 'store'); return { url: 'https://checkout.stripe.test/session' }; } } } }), { env: { PRICE: 'price_fixture' } }
  );
  return { post: () => post(new Request('https://site.test/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ productId: 'product', machineSlug: 'store' }) })), counts: () => ({ payments, heads }) };
}
for (const machine of [null, { products: [{ id: 'other' }] }]) { const h = checkout({ machine }); assert.equal((await h.post()).status, 404); assert.deepEqual(h.counts(), { payments: 0, heads: 0 }); }
for (const scenario of [{ asset: false }, { readError: true }]) { const h = checkout(scenario); const response = await h.post(); assert.equal(response.status, 503); assert.doesNotMatch(JSON.stringify(response), /private provider/); assert.deepEqual(h.counts(), { payments: 0, heads: 1 }); }
for (const scenario of [{ allowed: false }, { ready: false }]) { const h = checkout(scenario); assert.notEqual((await h.post()).status, 200); assert.deepEqual(h.counts(), { payments: 0, heads: 0 }); }
const h = checkout(); assert.equal((await h.post()).status, 200); assert.deepEqual(h.counts(), { payments: 1, heads: 1 });
console.log('PASS legacy catalogue product-machine binding and positive-byte private storage HEAD required before Stripe; missing/empty/unknown/error delivery fails closed');
