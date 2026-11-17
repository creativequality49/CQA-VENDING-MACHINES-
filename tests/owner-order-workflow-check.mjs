import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Run real route handlers with an in-memory query/RPC boundary. No provider writes.
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const machine = '00000000-0000-4000-8000-000000000003';
const offer = '00000000-0000-4000-8000-000000000004';
const orderId = '00000000-0000-4000-8000-000000000005';
const userId = '00000000-0000-4000-8000-000000000006';
let tables, queries, calls, uploads, rpcError, rpcData, verifiedOwner;
function reset() {
  tables = {
    cqa_orders: [{ id: orderId, business_id: id, machine_id: machine, offer_id: offer, customer_email: 'buyer@example.test', status: 'paid', amount_cents: 4900, currency: 'aud', created_at: '2026-11-17T00:00:00Z' },
      { id: other, business_id: other, customer_email: 'another-business@example.test' }],
    cqa_offers: [{ id: offer, business_id: id, machine_id: machine, name: 'Website delivery', offer_type: 'service', fulfillment_type: 'service' }],
    cqa_machines: [{ id: machine, business_id: id }],
    cqa_order_workspaces: [{ order_id: orderId, business_id: id, state: 'queued', revision: 2, intake: { businessName: 'Buyer business' }, delivery_message: '', asset_key: null, asset_name: null }],
    cqa_order_events: [{ id: other, order_id: orderId, actor_role: 'buyer', kind: 'submit_intake', message: '', created_at: '2026-11-17T00:00:00Z' }]
  };
  queries = []; calls = []; uploads = []; rpcError = null; rpcData = undefined;
  verifiedOwner = { id: userId, email: "owner@example.test", email_confirmed_at: "2026-11-17T00:00:00Z", is_anonymous: false };
}
class Query {
  constructor(table) { this.table = table; this.filters = []; this.memberships = []; this.offset = 0; this.end = Infinity; queries.push(this); }
  select(columns) { this.columns = columns; return this; }
  eq(field, value) { this.filters.push([field, value]); return this; }
  in(field, values) { this.memberships.push([field, values]); return this; }
  order() { return this; }
  range(from, to) { this.offset = from; this.end = to + 1; return this; }
  limit(value) { this.end = value; return this; }
  result() { return { data: (tables[this.table] || []).filter(row => this.filters.every(([key, value]) => row[key] === value) && this.memberships.every(([key, values]) => values.includes(row[key]))).slice(this.offset, this.end), error: null }; }
  maybeSingle() { const result = this.result(); return Promise.resolve({ data: result.data[0] || null, error: result.error }); }
  then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
}
const context = { get user() { return verifiedOwner; }, business: { id, name: 'Owner business' }, admin: { from: table => new Query(table) } };
const modules = {};
function load(file) {
  if (modules[file]) return modules[file];
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const dependencies = {
    'server-only': {},
    'zod': { z: undefined },
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/cqa-owner-auth': { requireCqaOwner: async (request, businessId) => {
      if (request.headers.get('authorization') !== 'Bearer owner') throw Object.assign(new Error('Authentication required.'), { status: 401 });
      if (businessId && businessId !== id) throw Object.assign(new Error('Business not owned.'), { status: 403 });
      return context;
    } },
    '@/lib/cqa-supabase-admin': { getCqaSupabaseAdmin: () => ({ rpc: async (name, args) => {
      calls.push({ name, args });
      if (rpcError) return { data: null, error: rpcError };
      if (rpcData !== undefined) return { data: rpcData, error: null };
      const workspace = tables.cqa_order_workspaces[0];
      if (workspace.revision !== args.p_expected_revision) return { data: null, error: { code: '40001' } };
      workspace.revision++;
      if (args.p_action === 'start') workspace.state = 'in_progress';
      if (args.p_action === 'deliver') { workspace.state = 'delivered'; workspace.delivery_message = args.p_payload.message; }
      if (args.p_action === 'attach_asset') { workspace.asset_key = args.p_payload.asset_key; workspace.asset_name = args.p_payload.asset_name; }
      return { data: { workspace: { ...workspace } }, error: null };
    } }) },
    '@/lib/storage': { uploadPrivateMarketplaceAsset: async (...args) => { uploads.push(args); } }
  };
  new Function('require', 'exports', compiled)(name => {
    if (name === 'zod') return zod;
    if (dependencies[name]) return dependencies[name];
    if (name.startsWith('@/')) return load(name.replace('@/', '') + '.ts');
    throw new Error('Unexpected dependency: ' + name);
  }, exports);
  modules[file] = exports;
  return exports;
}
const zod = await import('zod');
const list = load('app/api/owner/orders/route.ts');
const detail = load('app/api/owner/orders/[orderId]/route.ts');
const asset = load('app/api/owner/orders/[orderId]/asset/route.ts');
const route = { params: Promise.resolve({ orderId }) };
const request = (path = '', body, auth = true) => new Request('http://localhost/api/owner/orders' + path, {
  method: body === undefined ? 'GET' : 'POST', headers: { ...(auth ? { authorization: 'Bearer owner' } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
reset();
assert.equal((await list.GET(request('', undefined, false))).status, 401);
assert.equal((await list.GET(request('?businessId=' + other))).status, 403);
assert.equal((await list.GET(request('?limit=51'))).status, 400);
let response = await list.GET(request());
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
let payload = await response.json();
assert.equal(payload.orders.length, 1);
assert.equal(queries.length, 4, 'List uses four batched queries instead of per-order lookups');
assert.equal(payload.orders[0].offerName, 'Website delivery');
assert.equal(payload.orders[0].workspace.state, 'queued');
assert.equal(payload.orders[0].digital, false);
assert.match(queries.find(query => query.table === 'cqa_orders').columns, /purchase_snapshot/);
assert.match(queries.find(query => query.table === 'cqa_offers').columns, /offer_type,fulfillment_type/);
assert.ok(queries.filter(query => ['cqa_orders', 'cqa_offers', 'cqa_machines', 'cqa_order_workspaces'].includes(query.table)).every(query => query.filters.some(([key, value]) => key === 'business_id' && value === id)));
console.log('PASS owner order auth, pagination and every order/offer/machine/workspace business boundary');
reset();
tables.cqa_orders[0].purchase_snapshot = { title: 'Original monthly operations', offerType: 'subscription', fulfillmentType: 'subscription', asset_key: 'never-return-snapshot-key', fulfillment_config: { secret: 'never-return-snapshot-config' } };
tables.cqa_offers[0].offer_type = 'digital_product'; tables.cqa_offers[0].fulfillment_type = 'digital';
let historical = await (await list.GET(request())).json();
assert.equal(historical.orders[0].offerName, 'Original monthly operations');
assert.equal(historical.orders[0].offerType, 'subscription'); assert.equal(historical.orders[0].fulfillmentType, 'subscription');
assert.equal(historical.orders[0].digital, false);
assert.ok(!JSON.stringify(historical).includes('never-return-snapshot')); assert.ok(!JSON.stringify(historical).includes('purchase_snapshot'));
tables.cqa_offers = [];
historical = await (await list.GET(request())).json();
assert.equal(historical.orders[0].offerName, 'Original monthly operations'); assert.equal(historical.orders[0].offerType, 'subscription');
for (const invalid of [null, [], {}, { title: 'Untrusted', offerType: 'unknown', fulfillmentType: 'digital' }]) {
  tables.cqa_orders[0].purchase_snapshot = invalid;
  historical = await (await list.GET(request())).json();
  assert.equal(historical.orders[0].offerName, 'Offer unavailable'); assert.equal(historical.orders[0].digital, false);
}
reset();
tables.cqa_orders[0].purchase_snapshot = { title: 'Original digital kit', offerType: 'digital_product', fulfillmentType: 'digital' };
assert.equal((await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 2 }), route)).status, 409);
assert.equal(calls.length, 0, 'Editing a digital offer into a service cannot permit manual fulfilment of its old digital order');
console.log('PASS stable purchase snapshots preserve historical title/type without exposing snapshot contents');
for (const variant of [{ offer_type: 'digital_product' }, { fulfillment_type: 'digital' }]) {
  reset(); Object.assign(tables.cqa_offers[0], variant); tables.cqa_order_workspaces = [];
  const digital = await (await list.GET(request())).json();
  assert.equal(digital.orders[0].digital, true, 'Digital fulfilment is identified from the scoped offer');
  assert.equal((await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 0 }), route)).status, 409);
  assert.equal((await detail.POST(request('/' + orderId, { action: 'deliver', expectedRevision: 0, message: 'Manual delivery' }), route)).status, 409);
  const form = new FormData(); form.set('expectedRevision', '0'); form.set('file', new File(['delivery'], 'delivery.txt', { type: 'text/plain' }));
  assert.equal((await asset.POST(new Request('http://localhost/api/owner/orders/' + orderId + '/asset', { method: 'POST', headers: { authorization: 'Bearer owner' }, body: form }), route)).status, 409);
  assert.equal(calls.length, 0, 'Digital purchases must never reach the service transition RPC');
  assert.equal(uploads.length, 0, 'Digital purchases must never upload a manual delivery file');
}
console.log('PASS digital purchases use their library rather than impossible service intake or manual delivery');
for (const user of [
  { id: userId, email: 'owner@example.test', is_anonymous: false },
  { id: userId, email_confirmed_at: '2026-11-17T00:00:00Z', is_anonymous: false },
  { id: userId, email: ' ', email_confirmed_at: '2026-11-17T00:00:00Z', is_anonymous: false },
  { id: userId, email: 'owner@example.test', email_confirmed_at: '2026-11-17T00:00:00Z', is_anonymous: true }
]) {
  reset(); verifiedOwner = user;
  assert.equal((await list.GET(request())).status, 401);
  assert.equal((await detail.GET(request('/' + orderId), route)).status, 401);
  assert.equal((await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 2 }), route)).status, 401);
  const form = new FormData(); form.set('expectedRevision', '2'); form.set('file', new File(['delivery'], 'delivery.txt', { type: 'text/plain' }));
  const assetRequest = new Request('http://localhost/api/owner/orders/' + orderId + '/asset', { method: 'POST', headers: { authorization: 'Bearer owner' }, body: form });
  assert.equal((await asset.POST(assetRequest, route)).status, 401);
  assert.equal(queries.length, 0); assert.equal(calls.length, 0); assert.equal(uploads.length, 0);
}
console.log('PASS unconfirmed, email-less and anonymous owners denied before order queries, service RPC or storage');

reset();
tables.cqa_offers[0].machine_id = other;
response = await detail.GET(request('/' + orderId), route);
payload = await response.json();
assert.equal(payload.order.offerName, 'Offer unavailable');
assert.equal((await detail.GET(request('/' + other), { params: Promise.resolve({ orderId: other }) })).status, 404);
console.log('PASS mismatched machine offers are not named and another business order is not exposed');
reset();
tables.cqa_order_workspaces[0].asset_key = 'private-secret-key'; tables.cqa_order_workspaces[0].asset_name = 'handover.pdf';
payload = await (await detail.GET(request('/' + orderId), route)).json();
assert.equal(payload.order.workspace.hasAsset, true);
assert.equal(payload.order.workspace.assetName, 'handover.pdf');
assert.ok(!JSON.stringify(payload).includes('private-secret-key'));
assert.ok(!JSON.stringify(payload).includes('asset_key'));
console.log('PASS private asset keys never enter the owner JSON response');
reset();
response = await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 2 }), route);
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.order.workspace.state, 'in_progress');
assert.equal(payload.order.workspace.revision, 3);
assert.equal(calls[0].args.p_actor_user_id, userId);
assert.equal(calls[0].name, 'cqa_update_order_workspace');
assert.equal((await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 3, actor_user_id: other }), route)).status, 400);
console.log('PASS owner action uses verified identity and confirms an authoritative incremented workspace');
for (const data of [null, false, {}, [], { workspace: { order_id: other, business_id: id, revision: 3 } }, { workspace: { order_id: orderId, business_id: other, revision: 3 } }, { workspace: { order_id: orderId, business_id: id, revision: 2 } }]) {
  reset(); rpcData = data;
  response = await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 2 }), route);
  assert.equal(response.status, 409);
  assert.notEqual((await response.json()).updated, true);
}
reset(); rpcError = { code: '40001' };
assert.equal((await detail.POST(request('/' + orderId, { action: 'start', expectedRevision: 2 }), route)).status, 409);
reset(); tables.cqa_orders[0].status = 'refunded';
assert.equal((await detail.POST(request('/' + orderId, { action: 'deliver', expectedRevision: 2, message: 'Done' }), route)).status, 409);
assert.equal(calls.length, 0);
console.log('PASS stale/malformed RPC results and refunded orders never produce success');
async function upload(revision, contents = 'Delivery notes', type = 'text/plain') {
  const form = new FormData(); form.set('expectedRevision', String(revision)); form.set('file', new File([contents], 'handover.txt', { type }));
  return asset.POST(new Request('http://localhost/api/owner/orders/' + orderId + '/asset', { method: 'POST', headers: { authorization: 'Bearer owner' }, body: form }), route);
}
reset();
assert.equal((await upload(2)).status, 409); assert.equal(uploads.length, 0);
tables.cqa_order_workspaces[0].state = 'in_progress';
assert.equal((await upload(1)).status, 409); assert.equal(uploads.length, 0);
assert.equal((await upload(2, 'Not a PDF', 'application/pdf')).status, 400); assert.equal(uploads.length, 0);
assert.equal((await upload(2, 'x'.repeat(4 * 1024 * 1024 + 1))).status, 413); assert.equal(uploads.length, 0);
response = await upload(2);
assert.equal(response.status, 200);
payload = await response.json(); assert.equal(payload.uploaded, true); assert.equal(payload.order.workspace.hasAsset, true);
assert.ok(uploads[0][0].startsWith(`fulfillment/${id}/${orderId}/`));
assert.ok(!JSON.stringify(payload).includes(uploads[0][0]));
assert.equal(calls[0].args.p_payload.asset_size, new TextEncoder().encode('Delivery notes').length);
assert.equal(calls[0].args.p_payload.asset_type, 'text/plain');
console.log('PASS upload state/revision/type/size gates and private scoped asset attachment');
