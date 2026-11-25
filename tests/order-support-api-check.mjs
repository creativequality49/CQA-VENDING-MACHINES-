import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Exercise the actual handler with provider boundaries replaced by fixtures.
// SQL permissions and transitions are tested separately against real PL/pgSQL.
const require = createRequire(import.meta.url);
const buyer = '27000000-0000-4000-8000-000000000001';
const outsider = '27000000-0000-4000-8000-000000000002';
const owner = '27000000-0000-4000-8000-000000000003';
const business = '27000000-0000-4000-8000-000000000010';
const otherBusiness = '27000000-0000-4000-8000-000000000011';
const orderId = '27000000-0000-4000-8000-000000000020';
const otherOrder = '27000000-0000-4000-8000-000000000021';
const requestId = '27000000-0000-4000-8000-000000000100';
class CustomerOrderError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function harness() {
  const state = {
    reads: [], rpcCalls: [], authCalls: [], ownerCalls: [], customerOrderCalls: [],
    thread: { order_id: orderId, business_id: business, state: 'waiting_owner', revision: 1, delivery_confirmed_at: null },
    messages: [{ id: requestId, order_id: orderId, actor_user_id: buyer, actor_role: 'buyer', message: 'Please help with my machine.', created_at: '2026-11-26T00:00:00Z' }],
    order: { id: orderId, businessId: business, paymentStatus: 'paid', offerType: 'service', fulfillmentType: 'service', workspace: { state: 'delivered' } },
    rpcError: null, rpcResponse: undefined, readError: null,
  };
  const admin = {
    from(table) {
      const call = { table, filters: [], columns: '', limit: null, range: null };
      state.reads.push(call);
      const query = {
        select(columns) { call.columns = columns; return query; },
        eq(column, value) { call.filters.push([column, value]); return query; },
        order() { return query; },
        limit(value) { call.limit = value; return query; },
        range(from, to) { call.range = [from, to]; return query; },
        maybeSingle() { return Promise.resolve({ data: state.thread, error: state.readError }); },
        then(resolve, reject) { return Promise.resolve({ data: call.range ? state.messages.slice(call.range[0], call.range[1] + 1) : state.messages, error: state.readError }).then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) {
      state.rpcCalls.push({ name, args });
      if (state.rpcError) return { data: null, error: state.rpcError };
      if (state.rpcResponse !== undefined) return { data: state.rpcResponse, error: null };
      if (!state.thread) state.thread = { order_id: orderId, business_id: business, state: 'none', revision: 0, delivery_confirmed_at: null };
      state.thread = { ...state.thread, revision: args.p_expected_revision + 1 };
      return { data: { support: { ...state.thread }, request_id: args.p_request_id }, error: null };
    },
  };
  const source = ts.transpileModule(fs.readFileSync('lib/cqa-order-support.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', source)(name => {
    if (name === 'server-only') return {};
    if (name === '@/lib/cqa-supabase-admin') return { getCqaSupabaseAdmin: () => admin };
    if (name === '@/lib/cqa-customer-orders') return {
      CustomerOrderError,
      async requireCustomerOrderUser(request) {
        const token = request.headers.get('authorization');
        state.authCalls.push(token);
        if (!['Bearer buyer', 'Bearer outsider'].includes(token)) throw new CustomerOrderError(401, 'Verified account required');
        return token === 'Bearer buyer' ? buyer : outsider;
      },
      async getCustomerOrder(userId, id) {
        state.customerOrderCalls.push({ userId, id });
        if (id !== orderId || userId !== buyer) throw new CustomerOrderError(404, 'Order not found');
        return state.order;
      },
    };
    if (name === '@/lib/cqa-owner-auth') return {
      async requireCqaOwner(request, businessId) {
        state.ownerCalls.push({ businessId });
        if (request.headers.get('authorization') !== 'Bearer owner') throw Object.assign(new Error('Authentication required'), { status: 401 });
        if (businessId && businessId !== business) throw Object.assign(new Error('Business not owned'), { status: 403 });
        return { user: { id: owner }, business: { id: business } };
      },
    };
    if (name === '@/lib/cqa-owner-orders') return {
      requestBusinessId(request) { return new URL(request.url).searchParams.get('businessId') || undefined; },
      async ownerOrder(context, id) {
        if (id !== orderId) throw Object.assign(new Error('Order not found'), { status: 404 });
        assert.equal(context.business.id, business);
        return { id, business_id: business };
      },
    };
    return require(name);
  }, exports);
  const request = (body, token = 'buyer', query = '') => new Request(`https://app.test/api/customer/orders/${orderId}/support${query}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { state, handle: exports.handleOrderSupport, request };
}
const body = { action: 'message', message: 'Please help with my machine.', expectedRevision: 1, requestId };

{
  const { state, handle, request } = harness();
  for (const token of ['', 'invalid', 'unconfirmed']) assert.equal((await handle(request(undefined, token), orderId, 'customer')).status, 401);
  assert.equal((await handle(request(undefined, 'outsider'), orderId, 'customer')).status, 404);
  assert.equal((await handle(request(undefined), otherOrder, 'customer')).status, 404);
  assert.equal((await handle(request(body, ''), orderId, 'owner')).status, 401);
  assert.equal((await handle(request(body, 'owner', `?businessId=${otherBusiness}`), orderId, 'owner')).status, 403);
  assert.equal((await handle(request(body, 'owner'), otherOrder, 'owner')).status, 404);
  assert.equal(state.reads.length, 0); assert.equal(state.rpcCalls.length, 0);
  console.log('PASS support authenticates and scopes customer/merchant ownership before private reads or mutations');
}
{
  const { state, handle, request } = harness();
  let response = await handle(request(), orderId, 'customer');
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  let result = await response.json();
  assert.equal(result.canConfirmDelivery, true); assert.equal(result.support.messages[0].actorRole, 'buyer');
  assert.ok(!JSON.stringify(result).includes('actor_user_id')); assert.ok(!JSON.stringify(result).includes('business_id'));
  assert.deepEqual(state.reads[0].filters, [['order_id', orderId], ['business_id', business]]);
  assert.deepEqual(state.reads[1].filters, [['order_id', orderId]]);
  state.thread = null;
  result = await (await handle(request(), orderId, 'customer')).json();
  assert.equal(result.support.state, 'none'); assert.equal(result.support.revision, 0); assert.deepEqual(result.support.messages, []);
  console.log('PASS support reads use tenant/order filters, private caching and safe response fields including empty threads');
}
{
  const { state, handle, request } = harness();
  for (const page of ['-1', '1.5', 'x', '10001']) assert.equal((await handle(request(undefined, 'buyer', `?messagePage=${page}`), orderId, 'customer')).status, 400);
  assert.equal(state.reads.length, 0);
  state.messages = Array.from({ length: 102 }, (_, index) => ({ ...state.messages[0], id: `message-${index}`, message: `Message ${index}` }));
  let result = await (await handle(request(), orderId, 'customer')).json();
  assert.equal(result.support.messages.length, 100); assert.equal(result.support.hasMore, true); assert.equal(result.support.messagePage, 0);
  result = await (await handle(request(undefined, 'buyer', '?messagePage=1'), orderId, 'customer')).json();
  assert.equal(result.support.messages.length, 2); assert.equal(result.support.hasMore, false); assert.equal(result.support.messagePage, 1);
  assert.equal(result.support.messages[0].message, 'Message 101');
  assert.deepEqual(state.reads.at(-1).range, [100, 200]);
  console.log('PASS support message history validates pages, bounds responses and returns older messages in chronological order');
}
{
  const { state, handle, request } = harness();
  for (const invalid of ['{', 'x'.repeat(14001), { ...body, message: '' }, { ...body, message: ' '.repeat(5) },
    { ...body, message: 'x'.repeat(3001) }, { ...body, expectedRevision: -1 }, { ...body, requestId: 'bad-id' },
    { ...body, action: 'unknown' }, { ...body, action: 'resolve', message: 'Not allowed for this action' },
    { ...body, actorUserId: owner }, { ...body, businessId: otherBusiness }, { ...body, orderId: otherOrder }]) {
    const result = await handle(request(invalid), orderId, 'customer');
    assert.equal(result.status, typeof invalid === 'string' && invalid.length > 14000 ? 413 : 400);
  }
  assert.equal(state.rpcCalls.length, 0); assert.equal(state.reads.length, 0);
  console.log('PASS malformed, oversized, invalid and identity-overriding support payloads are rejected');
}
{
  const { state, handle, request } = harness();
  let response = await handle(request(body), orderId, 'customer');
  assert.equal(response.status, 200);
  assert.deepEqual(state.rpcCalls[0], { name: 'cqa_update_order_support', args: {
    p_order_id: orderId, p_actor_user_id: buyer, p_action: body.action, p_message: body.message,
    p_expected_revision: body.expectedRevision, p_request_id: requestId,
  } });
  response = await handle(request({ ...body, expectedRevision: 2 }, 'owner'), orderId, 'owner');
  assert.equal(response.status, 200); assert.equal(state.rpcCalls[1].args.p_actor_user_id, owner);
  const ownerResult = await response.json(); assert.equal(ownerResult.canConfirmDelivery, false);
  state.order.paymentStatus = 'refunded';
  response = await handle(request({ ...body, expectedRevision: 3 }), orderId, 'customer');
  assert.equal(response.status, 200); assert.equal((await response.json()).canConfirmDelivery, false);
  console.log('PASS mutations use server-derived actor/order IDs and refunded customers retain support access');
}
{
  const { state, handle, request } = harness();
  state.thread.revision = 3;
  state.rpcResponse = { support: { ...state.thread }, request_id: requestId };
  const response = await handle(request({ ...body, expectedRevision: 3 }), orderId, 'customer');
  assert.equal(response.status, 200, 'A retried request already included in the refreshed revision must be accepted');
  assert.equal(state.rpcCalls.length, 1);
  assert.equal((await response.json()).support.revision, 3);
  state.rpcResponse.request_id = otherOrder;
  assert.equal((await handle(request({ ...body, expectedRevision: 3 }), orderId, 'customer')).status, 503);
  console.log('PASS idempotent retry confirms its request ID even when a refresh already includes its revision');
}
{
  for (const [code, status] of [['42501', 404], ['P0002', 404], ['40001', 409], ['23514', 409], ['23505', 409], ['54000', 429], ['XX000', 503]]) {
    const { state, handle, request } = harness();
    state.rpcError = { code, message: 'PRIVATE_DATABASE_DETAIL' };
    const response = await handle(request(body), orderId, 'customer');
    assert.equal(response.status, status); assert.ok(!(await response.text()).includes('PRIVATE_DATABASE_DETAIL'));
    assert.equal(state.reads.length, 0);
  }
  console.log('PASS support conflicts/rate limits map to safe statuses without leaking database details');
}
{
  for (const mutation of [null, {}, { support: null }, { support: { order_id: otherOrder, business_id: business, revision: 2 } },
    { support: { order_id: orderId, business_id: otherBusiness, revision: 2 } },
    { support: { order_id: orderId, business_id: business, revision: 1 } }]) {
    const { state, handle, request } = harness(); state.rpcResponse = mutation;
    assert.equal((await handle(request(body), orderId, 'customer')).status, 503);
    assert.equal(state.reads.length, 0, 'Unconfirmed writes must not show success from an independent read');
  }
  for (const malformed of [{ order_id: otherOrder }, { business_id: otherBusiness }, { state: 'invalid' }, { revision: 0.5 }]) {
    const { state, handle, request } = harness(); Object.assign(state.thread, malformed);
    assert.equal((await handle(request(), orderId, 'customer')).status, 503);
  }
  for (const malformed of [{ order_id: otherOrder }, { actor_role: 'admin' }]) {
    const { state, handle, request } = harness(); Object.assign(state.messages[0], malformed);
    assert.equal((await handle(request(), orderId, 'customer')).status, 503);
  }
  console.log('PASS inconsistent RPC records, cross-order threads/messages and invalid roles fail closed');
}
{
  for (const override of [{ paymentStatus: 'pending' }, { paymentStatus: 'refunded' }, { workspace: { state: 'in_progress' } },
    { offerType: 'digital_product' }, { fulfillmentType: 'digital' }, { offerType: 'physical_product' }, { fulfillmentType: 'shipping' }]) {
    const { state, handle, request } = harness(); Object.assign(state.order, override);
    assert.equal((await handle(request({ ...body, action: 'confirm_delivery', message: '' }), orderId, 'customer')).status, 409);
    assert.equal(state.rpcCalls.length, 0);
  }
  const { state, handle, request } = harness();
  assert.equal((await handle(request({ ...body, action: 'confirm_delivery', message: '' }, 'owner'), orderId, 'owner')).status, 409);
  assert.equal(state.rpcCalls.length, 0);
  console.log('PASS receipt confirmation is customer-only and requires a paid delivered service, separate from digital/physical fulfilment');
}

function inboxHarness() {
  const state = {
    queries: [], ownerCalls: [],
    support: [{ order_id: orderId, business_id: business, updated_at: '2026-11-26T00:00:00Z', revision: 1 }],
    orders: [{ id: orderId, business_id: business, purchase_snapshot: { title: 'Machine setup' } }],
    supportError: null,
  };
  function client(boundary) {
    return { from(table) {
      const query = { boundary, table, filters: [], range: null, ordering: [] };
      state.queries.push(query);
      const builder = {
        select(columns) { query.columns = columns; return builder; },
        eq(key, value) { query.filters.push([key, value]); return builder; },
        in(key, value) { query.filters.push([key, value]); return builder; },
        order(key, value) { query.ordering.push([key, value]); return builder; },
        range(from, to) { query.range = [from, to]; return builder; },
        then(resolve, reject) { return Promise.resolve({ data: boundary === 'service' ? state.support : state.orders, error: boundary === 'service' ? state.supportError : null }).then(resolve, reject); },
      };
      return builder;
    } };
  }
  const source = ts.transpileModule(fs.readFileSync('app/api/owner/order-support/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function('require', 'exports', source)(name => {
    if (name === '@/lib/cqa-supabase-admin') return { getCqaSupabaseAdmin: () => client('service') };
    if (name === '@/lib/cqa-owner-auth') return { async requireCqaOwner(request, businessId) {
      const token = request.headers.get('authorization'); state.ownerCalls.push({ token, businessId });
      if (!['Bearer owner', 'Bearer unconfirmed'].includes(token)) throw Object.assign(new Error('Authentication required'), { status: 401 });
      if (businessId && businessId !== business) throw Object.assign(new Error('Business not owned'), { status: 403 });
      return { business: { id: business }, user: { email_confirmed_at: token === 'Bearer owner' ? '2026-11-26' : null }, admin: client('owner_rls') };
    } };
    if (name === '@/lib/cqa-owner-orders') return {
      requestBusinessId(request) { return new URL(request.url).searchParams.get('businessId') || undefined; },
      requireVerifiedOrderOwner(context) { if (!context.user.email_confirmed_at) throw Object.assign(new Error('Verified owner required'), { status: 401 }); },
      safeOwnerOrderError(error) { return { status: [400, 401, 403, 404].includes(error.status) ? error.status : 503, error: 'Inbox unavailable' }; },
    };
    return require(name);
  }, exports);
  return { state, get: exports.GET, request: (query = '', token = 'owner') => new Request(`https://app.test/api/owner/order-support${query}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }) };
}
{
  const { state, get, request } = inboxHarness();
  assert.equal((await get(request('', ''))).status, 401);
  assert.equal((await get(request('', 'unconfirmed'))).status, 401);
  assert.equal((await get(request(`?businessId=${otherBusiness}`))).status, 403);
  for (const query of ['?page=-1', '?page=1.5', '?page=10001', '?page=x']) assert.equal((await get(request(query))).status, 400);
  assert.equal(state.queries.length, 0);
  const response = await get(request('?page=1'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const result = await response.json();
  assert.equal(result.threads[0].title, 'Machine setup'); assert.equal(result.page, 1);
  assert.deepEqual(state.queries[0].filters, [['business_id', business], ['state', 'waiting_owner']]);
  assert.deepEqual(state.queries[0].range, [20, 40]);
  assert.deepEqual(state.queries[0].ordering.map(([key]) => key), ['updated_at', 'order_id']);
  assert.equal(state.queries[1].boundary, 'owner_rls');
  assert.deepEqual(state.queries[1].filters, [['business_id', business], ['id', [orderId]]]);
  assert.ok(!JSON.stringify(result).includes('business_id'));
  console.log('PASS owner support inbox verifies identity/tenant, validates pagination and double-checks orders with owner RLS');
}
{
  const { state, get, request } = inboxHarness();
  state.support[0].business_id = otherBusiness;
  assert.equal((await get(request())).status, 503); assert.equal(state.queries.length, 1);
  state.support[0].business_id = business; state.orders[0].business_id = otherBusiness;
  assert.deepEqual((await (await get(request())).json()).threads, [], 'A thread without a matching owner-visible order cannot leak its reference');
  state.orders[0].business_id = business;
  state.orders[0].purchase_snapshot.title = 'x'.repeat(301);
  assert.equal((await (await get(request())).json()).threads[0].title, 'Customer order');
  state.support = Array.from({ length: 21 }, (_, index) => ({ order_id: index ? otherOrder : orderId, business_id: business, revision: 1, updated_at: '2026-11-26' }));
  const page = await (await get(request())).json(); assert.equal(page.hasMore, true); assert.ok(page.threads.length <= 20);
  console.log('PASS owner inbox fails closed on tenant mismatches, omits inaccessible orders and bounds pages/titles');
}
