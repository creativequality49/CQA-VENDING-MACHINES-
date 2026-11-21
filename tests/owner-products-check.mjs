import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ids = Array.from({ length: 7 }, (_, n) => `20000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`);
const [businessId, machineId, productId, ownerId, otherId] = ids;
let state;
function reset(overrides = {}) {
  state = { user: { id: ownerId, email: 'owner@example.test', email_confirmed_at: '2026-11-20', is_anonymous: false }, calls: [], queries: [], headChecks: [],
    product: { id: productId, business_id: businessId, machine_id: machineId, name: 'Dispatch-ready product', description: 'A real merchant product', price_cents: 4900, currency: 'aud', active: true, offer_type: 'physical_product', fulfillment_type: 'shipping', product_revision: 3, inventory_tracking: true, inventory_quantity: 5, fulfillment_config: {} },
    rpcError: null, response: undefined, inventoryResponse: undefined, missingMachine: false, ...overrides };
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.memberships = []; this.start = 0; this.end = Infinity; state.queries.push(this); }
  select() { return this; }
  eq(field, value) { this.filters.push([field, value]); return this; }
  in(field, values) { this.memberships.push([field, values]); return this; }
  order() { return this; }
  limit(value) { this.end = value; return this; }
  range(start, end) { this.start = start; this.end = end + 1; return this; }
  result() {
    const rows = this.table === 'cqa_offers' ? [state.product] : this.table === 'cqa_machines' ? (state.missingMachine ? [] : [{ id: machineId, business_id: businessId, title: 'Storefront' }]) : [];
    return { data: rows.filter(row => this.filters.every(([field, value]) => row[field] === value) && this.memberships.every(([field, values]) => values.includes(row[field]))).slice(this.start, this.end), error: null };
  }
  async maybeSingle() { const result = this.result(); return { ...result, data: result.data[0] || null }; }
  then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
}
const admin = {
  from: table => new Query(table),
  rpc: async (name, args) => {
    state.calls.push({ name, args });
    if (state.rpcError) return { data: null, error: state.rpcError };
    if (name === 'cqa_owner_product_inventory') return { data: state.inventoryResponse ?? { inventory: [{ offer_id: productId, reserved_quantity: 0, available_quantity: state.product.offer_type === 'digital_product' ? null : state.product.inventory_quantity }] }, error: null };
    const product = { ...state.product, ...args.p_product, product_revision: (args.p_expected_revision ?? 0) + 1 };
    return { data: state.response === undefined ? { product, reserved_quantity: 0, available_quantity: product.inventory_quantity } : state.response, error: null };
  }
};
const cached = new Map();
function load(file) {
  if (cached.has(file)) return cached.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'exports', code)(name => {
    if (name === 'server-only') return {};
    if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
    if (name === '@/lib/cqa-owner-auth') return { requireCqaOwner: async (request, selectedBusiness) => {
      if (request.headers.get('authorization') !== 'Bearer confirmed-owner') throw Object.assign(new Error('Sign in'), { status: 401 });
      if (selectedBusiness && selectedBusiness !== businessId) throw Object.assign(new Error('Business not owned'), { status: 403 });
      return { user: state.user, business: { id: businessId, name: 'Owner business' }, admin };
    } };
    if (name === '@/lib/storage') return { verifyPrivateMarketplaceAsset: async (...args) => { state.headChecks.push(args); if (state.assetError) throw Error('Private storage error'); return !state.assetMissing; } };
    if (name === '@/lib/cqa-supabase-admin') return { getCqaSupabaseAdmin: () => admin };
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
    return require(name);
  }, exports);
  cached.set(file, exports); return exports;
}
const api = load('app/api/owner/products/route.ts');
const base = { businessId, machineId, id: productId, expectedRevision: 3, name: 'Dispatch-ready product', description: 'A real merchant product',
  priceCents: 4900, currency: 'aud', kind: 'physical', imageUrl: null, active: true, inventoryDelta: 0,
  deliveryDescription: 'Shipped by the business', deliveryTiming: 'Three business days', supportDetails: 'Email support@example.test', refundTerms: 'Return unopened items within 14 days',
  shipping: { supportedRegions: ['AU'], flatFeeCents: 900, dispatchTiming: 'Packed within two days' } };
function request(body, token = 'confirmed-owner', query = '') {
  return new Request('http://localhost/api/owner/products' + query, { method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
reset();
assert.equal((await api.GET(request(undefined, 'outsider'))).status, 401);
assert.equal((await api.GET(request(undefined, undefined, '?businessId=' + otherId))).status, 403);
assert.equal((await api.POST(request({ ...base, businessId: otherId }))).status, 403);
assert.equal(state.calls.length, 0);
state.missingMachine = true;
assert.equal((await api.POST(request(base))).status, 404);
assert.equal(state.calls.length, 0);
console.log('PASS product read/write owner boundary and storefront ownership before privileged RPC');
for (const user of [{ id: ownerId, email: 'owner@example.test' }, { id: ownerId, email_confirmed_at: '2026-11-20' }, { id: ownerId, email: 'owner@example.test', email_confirmed_at: '2026-11-20', is_anonymous: true }]) {
  reset({ user });
  assert.equal((await api.GET(request())).status, 401);
  assert.equal((await api.POST(request(base))).status, 401);
  assert.equal(state.calls.length, 0);
}
console.log('PASS unconfirmed, email-less and anonymous merchant accounts cannot read or save products');
reset();
state.product = { ...state.product, offer_type: 'digital_product', fulfillment_type: 'digital', inventory_tracking: false, inventory_quantity: null, fulfillment_config: { asset_key: `marketplace/${businessId}/${productId}/private.pdf`, asset_size_bytes: 10, asset_content_type: 'application/pdf', deliveryDescription: 'Download' } };
let response = await api.GET(request());
assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
let payload = await response.json();
assert.equal(payload.products[0].assetReady, true);
assert.ok(!JSON.stringify(payload).includes('asset_key'));
assert.ok(!JSON.stringify(payload).includes('/private.pdf'));
assert.ok(state.queries.every(query => query.filters.some(([field, value]) => field === 'business_id' && value === businessId)));
assert.equal((await api.GET(request(undefined, undefined, '?limit=101'))).status, 400);
console.log('PASS product list is business-scoped, paginated and strips private asset keys');
for (const input of [
  { ...base, priceCents: -1 }, { ...base, priceCents: 49 }, { ...base, inventoryDelta: 1.5 },
  { ...base, inventory_quantity: -5 }, { ...base, asset_key: 'public-product.pdf' },
  { ...base, expectedRevision: undefined }, { ...base, expectedRevision: -1 },
  { ...base, imageUrl: 'javascript:alert(1)' }, { ...base, imageUrl: 'https://127.0.0.1/private' },
  { ...base, imageUrl: 'https://user:password@images.example.test/file.jpg' },
  { ...base, shipping: { ...base.shipping, flatFeeCents: -1 } },
  { ...base, shipping: { ...base.shipping, supportedRegions: ['AU', 'AU'] } }
]) {
  reset(); response = await api.POST(request(input)); assert.equal(response.status, 400); assert.equal(state.calls.length, 0);
}
reset();
response = await api.POST(new Request('http://localhost/api/owner/products', { method: 'POST', headers: { authorization: 'Bearer confirmed-owner', 'content-type': 'application/json' }, body: JSON.stringify({ ...base, description: 'x'.repeat(70 * 1024) }) }));
assert.equal(response.status, 413); assert.equal(state.calls.length, 0);
console.log('PASS invalid price/stock/revision/images, asset injection and oversized product bodies fail before RPC');
reset();
assert.equal((await api.POST(request({ ...base, expectedRevision: 2 }))).status, 409); assert.equal(state.calls.length, 0);
reset({ rpcError: { code: '40001', message: 'private SQL detail' } });
assert.equal((await api.POST(request(base))).status, 409);
reset({ rpcError: { code: '23514', message: 'stock cannot fall below reserved units' } });
response = await api.POST(request({ ...base, inventoryDelta: -8 }));
assert.equal(response.status, 409); assert.ok(!JSON.stringify(await response.json()).includes('stock cannot'));
assert.equal(state.calls[0].args.p_inventory_delta, -8, 'Signed adjustments go to the locking SQL boundary; never directly overwrite stock totals');
assert.equal(state.calls[0].args.p_actor_user_id, ownerId);
assert.equal(state.calls[0].name, 'cqa_owner_save_product');
console.log('PASS stale revisions and SQL inventory floor errors cannot report a saved product');
reset();
response = await api.POST(request(base)); assert.equal(response.status, 200);
payload = await response.json(); assert.equal(payload.product.id, productId); assert.equal(payload.product.product_revision, 4);
reset();
const { id: _id, expectedRevision: _revision, ...create } = base;
assert.equal((await api.POST(request({ ...create, inventoryDelta: -1 }))).status, 400); assert.equal(state.calls.length, 0);
response = await api.POST(request({ ...create, inventoryDelta: 5 })); assert.equal(response.status, 201);
assert.equal(state.calls[0].args.p_offer_id, null); assert.equal(state.calls[0].args.p_expected_revision, null);
console.log('PASS successful saves bind verified owner/business/storefront identity and confirm revisions');
for (const malformed of [null, {}, { product: {} }, { product: { id: otherId } },
  { product: { ...state.product, product_revision: 4 }, reserved_quantity: 6, available_quantity: -1 },
  { product: { ...state.product, business_id: otherId, product_revision: 4 }, reserved_quantity: 0, available_quantity: 5 },
  { product: { ...state.product, product_revision: 3 }, reserved_quantity: 0, available_quantity: 5 }
]) {
  reset({ response: malformed });
  response = await api.POST(request(base));
  assert.equal(response.status, 503); assert.equal((await response.json()).product, undefined);
}
for (const malformed of [{ inventory: [] }, { inventory: [{ offer_id: otherId, reserved_quantity: 0, available_quantity: 1 }] },
  { inventory: [{ offer_id: productId, reserved_quantity: -1, available_quantity: 6 }] },
  { inventory: [{ offer_id: productId, reserved_quantity: 0, available_quantity: 5 }, { offer_id: productId, reserved_quantity: 0, available_quantity: 5 }] }
]) {
  reset({ inventoryResponse: malformed });
  response = await api.GET(request()); assert.equal(response.status, 503); assert.equal((await response.json()).products, undefined);
}
console.log('PASS malformed save/aggregate results cannot invent stock, product ownership or saved revisions');

reset();
const { shipping: _shipping, ...digital } = base;
state.product = { ...state.product, offer_type: 'digital_product', fulfillment_type: 'digital' };
assert.equal((await api.POST(request({ ...digital, kind: 'digital', inventoryDelta: 1 }))).status, 400);
assert.equal((await api.POST(request({ ...digital, kind: 'digital' }))).status, 409);
assert.equal(state.calls.length, 0);
console.log('PASS digital products cannot invent physical stock or publish without a private file');

for (const [overrides, expectedStatus] of [[{ assetMissing: true }, 409], [{ assetError: true }, 503], [{}, 200]]) {
  reset(overrides);
  state.product = { ...state.product, offer_type: 'digital_product', fulfillment_type: 'digital', inventory_tracking: false, inventory_quantity: null,
    fulfillment_config: { asset_key: `marketplace/${businessId}/${productId}/ready.pdf`, asset_size_bytes: 10, asset_content_type: 'application/pdf' } };
  response = await api.POST(request({ ...digital, kind: 'digital' })); assert.equal(response.status, expectedStatus);
  assert.equal(state.headChecks.length, 1);
  assert.equal(state.calls.length, expectedStatus === 200 ? 1 : 0);
  assert.ok(!(await response.text()).includes('Private storage error'));
}
console.log('PASS actual private-object verification is required before activating an existing digital product');
