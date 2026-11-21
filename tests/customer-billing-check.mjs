import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const buyer = '10000000-0000-4000-8000-000000000001';
const stranger = '10000000-0000-4000-8000-000000000002';
const orderId = '10000000-0000-4000-8000-000000000003';
class CustomerOrderError extends Error { constructor(status, message) { super(message); this.status = status; } }
function harness() {
  const state = {
    queries: [], providerCalls: [], authCalls: [], authError: false, dbError: false,
    order: { id: orderId, business_id: 'business', machine_id: 'machine', offer_id: 'offer', customer_user_id: buyer, buyer_user_id: buyer, stripe_checkout_session_id: 'cs_owned', status: 'paid' },
    offer: { id: 'offer', business_id: 'business', machine_id: 'machine', offer_type: 'subscription' },
    account: { business_id: 'business', stripe_account_id: 'acct_business' },
    session: { id: 'cs_owned', mode: 'subscription', client_reference_id: buyer, customer: 'cus_buyer', subscription: 'sub_owned', metadata: { cqaBusinessId: 'business', cqaMachineId: 'machine', cqaOfferId: 'offer', cqaBuyerUserId: buyer } },
    subscription: { id: 'sub_owned', customer: 'cus_buyer', status: 'active', metadata: { cqaBusinessId: 'business', cqaMachineId: 'machine', cqaOfferId: 'offer', cqaBuyerUserId: buyer } },
    portalUrl: 'https://billing.stripe.com/p/session/fixture'
  };
  const admin = { from(table) {
    const call = { table, filters: [], identity: null }; state.queries.push(call);
    const q = { select() { return q; }, eq(key, value) { call.filters.push([key, value]); return q; },
      or(value) { call.identity = value; return q; }, async maybeSingle() {
        if (state.dbError) return { data: null, error: Error('private-database-detail') };
        let row = table === 'cqa_orders' ? state.order : table === 'cqa_offers' ? state.offer : state.account;
        if (row && !call.filters.every(([key, value]) => row[key] === value)) row = null;
        if (row && call.identity) { const userId = call.identity.split(',')[0].split('.').at(-1); if (row.customer_user_id !== userId && row.buyer_user_id !== userId) row = null; }
        return { data: row ? { ...row } : null, error: null };
      } };
    return q;
  } };
  const provider = async (kind, id, options) => {
    state.providerCalls.push({ kind, id, options });
    assert.equal(options.stripeAccount, 'acct_business');
    if (state.providerError) throw Error('private-stripe-credential-detail');
    return kind === 'session' ? state.session : state.subscription;
  };
  const stripe = { checkout: { sessions: { retrieve: (id, _params, options) => provider('session', id, options) } },
    subscriptions: { retrieve: (id, _params, options) => provider('subscription', id, options) },
    billingPortal: { sessions: { async create(params, options) { state.providerCalls.push({ kind: 'portal', params, options }); assert.equal(options.stripeAccount, 'acct_business'); return { url: state.portalUrl }; } } } };
  const dependencies = {
    'server-only': {}, '@/lib/cqa-supabase-admin': { getCqaSupabaseAdmin: () => admin },
    '@/lib/stripe': { getStripeClient: () => { if (state.configError) throw Error('STRIPE_SECRET_KEY sensitive'); return stripe; } },
    '@/lib/cqa-site-url': { getCqaSiteUrl: () => 'https://app.example.test' },
    '@/lib/cqa-customer-orders': { CustomerOrderError,
      async requireCustomerOrderUser(request) { state.authCalls.push(request.headers.get('authorization')); if (state.authError || !request.headers.get('authorization')) throw new CustomerOrderError(401, 'Verified account required'); return buyer; },
      customerOrderErrorResponse(error) { return Response.json({ error: error instanceof CustomerOrderError ? error.message : 'Orders are temporarily unavailable' }, { status: error instanceof CustomerOrderError ? error.status : 503, headers: { 'Cache-Control': 'no-store' } }); }
    }
  };
  function evaluate(path) {
    const compiled = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports = {};
    new Function('require', 'exports', 'Response', 'URL', compiled)(name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), exports, Response, URL);
    return exports;
  }
  const api = evaluate('lib/cqa-customer-billing.ts'); dependencies['@/lib/cqa-customer-billing'] = api;
  const route = evaluate('app/api/customer/orders/[orderId]/billing/route.ts');
  return { state, api, async post(token = 'verified') {
    return route.POST(new Request(`https://app.example.test/api/customer/orders/${orderId}/billing`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }), { params: Promise.resolve({ orderId }) });
  } };
}
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);
{
  const { api, state, post } = harness();
  assert.equal((await post('')).status, 401); assert.equal(state.queries.length, 0);
  await rejects(api.createCustomerBillingPortal(new Request('https://app.test'), stranger, orderId), 404);
  assert.equal(state.providerCalls.length, 0);
  await rejects(api.createCustomerBillingPortal(new Request('https://app.test'), 'bad,id', orderId), 401);
  await rejects(api.createCustomerBillingPortal(new Request('https://app.test'), buyer, 'bad-order'), 400);
}
console.log('PASS verified identity and durable purchaser ownership gate billing before provider access');
for (const mutate of [
  state => { state.account.business_id = 'foreign-business'; },
  state => { state.session.client_reference_id = stranger; },
  state => { state.session.metadata.cqaBuyerUserId = stranger; },
  state => { state.session.metadata.cqaBusinessId = 'foreign-business'; },
  state => { state.session.metadata.cqaMachineId = 'foreign-machine'; },
  state => { state.session.metadata.cqaOfferId = 'foreign-offer'; },
  state => { state.session.mode = 'payment'; },
  state => { state.session.customer = null; },
  state => { state.session.subscription = null; },
  state => { state.subscription.customer = 'cus_stranger'; },
  state => { state.subscription.metadata.cqaOfferId = 'foreign-offer'; },
]) {
  const { state, post } = harness(); mutate(state);
  const result = await post(); assert.equal(result.status, 404);
  assert.ok(!state.providerCalls.some(call => call.kind === 'portal'));
}
console.log('PASS connected-account, historical product, session, customer and subscription metadata tampering cannot open billing');
for (const mutate of [
  state => { state.offer = null; },
  state => { state.offer.offer_type = 'digital_product'; },
  state => { state.offer.machine_id = 'another-machine'; }
]) {
  const { state, post } = harness(); mutate(state);
  assert.equal((await post()).status, 200);
  assert.ok(!state.queries.some(query => query.table === 'cqa_offers'));
}
console.log('PASS edited/deleted catalogue offers cannot strand a correctly bound historical subscription');
for (const status of ['paid', 'cancelled', 'refunded', 'disputed']) {
  const { state, post } = harness(); state.order.status = status;
  if (status !== 'paid') { state.order.buyer_user_id = null; state.subscription.status = 'canceled'; }
  const result = await post(); assert.equal(result.status, 200);
  assert.equal((await result.json()).url, state.portalUrl);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  const portal = state.providerCalls.find(call => call.kind === 'portal');
  assert.deepEqual(portal.params, { customer: 'cus_buyer', return_url: `https://app.example.test/account/orders/${orderId}` });
  assert.ok(!state.queries.some(query => query.table === 'cqa_order_workspaces'));
  assert.equal(state.order.status, status, 'Billing access cannot grant or modify fulfilment entitlement');
}
console.log('PASS cancellation/refund retains billing management without granting delivery access');
for (const option of ['dbError', 'providerError', 'configError']) {
  const { state, post } = harness(); state[option] = true;
  const result = await post(); assert.equal(result.status, 503);
  assert.ok(!JSON.stringify(await result.json()).match(/private-|STRIPE_SECRET_KEY|sensitive/));
}
for (const url of ['http://billing.stripe.com/session', 'https://billing.stripe.com.evil.test/session', 'https://user:secret@billing.stripe.com/session', 'javascript:alert(1)']) {
  const { state, post } = harness(); state.portalUrl = url;
  assert.equal((await post()).status, 503);
}
console.log('PASS provider failures are redacted and portal destinations require the exact Stripe billing origin');
