import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
export const ids = { business: '30000000-0000-4000-8000-000000000001', machine: '30000000-0000-4000-8000-000000000002', offer: '30000000-0000-4000-8000-000000000003', buyer: '30000000-0000-4000-8000-000000000004', order: '30000000-0000-4000-8000-000000000005', reservation: '30000000-0000-4000-8000-000000000006' };
const clone = value => structuredClone(value);
export function merchantHarness(options = {}) {
  const config = { provider: 'merchant', deliveryDescription: 'A physical product shipped by the merchant', deliveryTiming: 'Delivered in three business days', supportDetails: 'support@example.test', refundTerms: 'Returns within fourteen days', shipping: { supportedRegions: ['AU'], flatFeeCents: 900, dispatchTiming: 'Packed in two business days' } };
  const state = { physicalGate: true, physicalPilot: true, launchGate: true, stock: 1, reservations: [], orders: [], contacts: [], webhookEvents: [], rpcCalls: [], operations: [], sessions: [], expirations: [], notifications: [], automations: [], retrieveCalls: [], event: null, rpcFaults: {}, ...options };
  state.offer = { id: ids.offer, business_id: ids.business, machine_id: ids.machine, active: true, name: 'Merchant product', description: 'A merchant product', price_cents: 4900, currency: 'aud', offer_type: 'physical_product', fulfillment_type: 'shipping', shipping_required: true, inventory_tracking: true, inventory_quantity: 1, fulfillment_config: config, ...options.offer };
  state.context = { business_id: ids.business, machine_id: ids.machine, offer_id: ids.offer, machine_slug: 'merchant-store', offer_type: 'physical_product', offer_name: 'Merchant product', offer_description: 'A merchant product', currency: 'aud', price_cents: 4900, business_plan: 'pro', connected_account_id: 'acct_merchant', charges_enabled: true, onboarding_complete: true, ...options.context };
  state.user = { id: ids.buyer, email: 'buyer@example.test', email_confirmed_at: '2026-11-20', is_anonymous: false, ...options.user };
  function rows(table) {
    if (table === 'cqa_orders') return state.orders;
    if (table === 'cqa_contacts') return state.contacts;
    if (table === 'cqa_stripe_webhook_events') return state.webhookEvents;
    if (table === 'cqa_connected_accounts') return [{ business_id: ids.business, stripe_account_id: 'acct_merchant' }];
    if (table === 'cqa_offers') return [state.offer];
    if (table === 'cqa_plan_subscriptions') return [{ business_id: ids.business, status: 'active' }];
    throw new Error('Unexpected table: ' + table);
  }
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.operation = 'select'; }
    select() { return this; }
    eq(key, value) { this.filters.push(['eq', key, value]); return this; }
    neq(key, value) { this.filters.push(['neq', key, value]); return this; }
    is(key, value) { this.filters.push(['eq', key, value]); return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return this; }
    upsert(payload, config) { this.operation = 'upsert'; this.payload = payload; this.config = config; return this; }
    execute() {
      state.operations.push([this.table, this.operation]);
      const all = rows(this.table);
      if (state.orderInsertError && this.table === 'cqa_orders' && this.operation === 'insert') return { data: null, error: { message: 'Private SQL detail' } };
      if (this.operation === 'insert' || this.operation === 'upsert') {
        const conflict = this.table === 'cqa_orders' ? 'stripe_checkout_session_id' : this.table === 'cqa_stripe_webhook_events' ? 'event_id' : 'email';
        const existing = all.find(row => row[conflict] === this.payload[conflict]);
        if (existing && this.operation === 'insert') return { data: null, error: { code: '23505' } };
        if (existing) { if (!this.config?.ignoreDuplicates) Object.assign(existing, clone(this.payload)); return { data: [clone(existing)], error: null }; }
        const created = { id: this.table === 'cqa_orders' ? ids.order : 'fixture-contact', ...clone(this.payload) }; all.push(created);
        return { data: [clone(created)], error: null };
      }
      const matched = all.filter(row => this.filters.every(([kind, key, value]) => kind === 'eq' ? row[key] === value : row[key] !== value));
      if (this.operation === 'update') for (const row of matched) Object.assign(row, clone(this.payload));
      return { data: clone(matched), error: null };
    }
    async maybeSingle() { const result = this.execute(); return { ...result, data: result.data?.[0] || null }; }
    single() { return this.maybeSingle(); }
    then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
  }
  const admin = { from: table => new Query(table), auth: { admin: { getUserById: async id => ({ data: { user: { ...state.user, id } }, error: null }) } },
    rpc: async (name, args) => {
      state.rpcCalls.push({ name, args: clone(args) });
      if (state.rpcFaults[name]) return { data: null, error: state.rpcFaults[name] };
      if (name === 'cqa_reserve_inventory') {
        if (state.reservations.filter(item => item.state === 'reserved' || item.state === 'committed').length >= state.stock) return { data: null, error: { code: '23514' } };
        const reservation = { id: ids.reservation, offer_id: ids.offer, buyer_user_id: ids.buyer, quantity: 1, state: 'reserved', offer_snapshot: { title: state.context.offer_name, offerType: state.context.offer_type, fulfillmentType: state.offer.fulfillment_type, priceCents: state.context.price_cents, currency: state.context.currency, productRevision: state.offer.product_revision, terms: Object.fromEntries(['deliveryDescription', 'deliveryTiming', 'supportDetails', 'refundTerms'].map(key => [key, state.offer.fulfillment_config[key]])), shipping: { ...state.offer.fulfillment_config.shipping } }, ...state.reservationOverrides };
        state.reservations.push(reservation); return { data: { reservation: clone(reservation) }, error: null };
      }
      if (name === 'cqa_bind_inventory_reservation') {
        const reservation = state.reservations.find(item => item.id === args.p_reservation_id);
        Object.assign(reservation, { checkout: args.p_checkout_session_id, stripe_checkout_session_id: args.p_checkout_session_id, checkout_session_id: args.p_checkout_session_id, order: args.p_order_id, order_id: args.p_order_id }); return { data: { reservation }, error: null };
      }
      if (name === 'cqa_release_inventory_reservation' || name === 'cqa_settle_inventory_reservation') {
        const reservation = state.reservations.find(item => name === 'cqa_release_inventory_reservation' ? item.id === args.p_reservation_id : item.checkout === args.p_checkout_session_id);
        if (reservation) {
          if (name === 'cqa_release_inventory_reservation' && reservation.checkout) return { data: null, error: { code: '23514' } };
          if (reservation.state === 'reserved') reservation.state = 'released';
        }
        return { data: { reservation }, error: null };
      }
      if (name === 'cqa_record_product_fulfillment') {
        const order = state.orders.find(item => item.id === args.p_order_id && item.stripe_checkout_session_id === args.p_checkout_session_id);
        if (!order || order.status !== 'paid') return { data: null, error: { code: '23514' } };
        if (!state.fulfillment) {
          const reservation = state.reservations.find(item => item.checkout === args.p_checkout_session_id);
          if (!reservation || !['reserved', 'committed'].includes(reservation.state)) return { data: null, error: { code: '23514' } };
          reservation.state = 'committed';
          if (order.purchase_snapshot.fulfilmentType === 'supplier_shipped') {
            state.supplierFulfillment = { orderId: order.id, provider: order.purchase_snapshot.shipping.provider, sku: order.purchase_snapshot.sku, status: 'awaiting_approval' };
          }
          state.fulfillment = { job: { order_id: order.id, kind: 'physical_shipment', state: 'queued' }, shipment: { order_id: order.id, business_id: ids.business, state: 'ready', revision: 0 }, reservation };
          state.commits = (state.commits || 0) + 1;
        }
        return { data: state.fulfillmentResponse ?? clone(state.fulfillment), error: null };
      }
      throw new Error('Unexpected RPC: ' + name);
    }
  };
  const stripe = {
    accounts: { retrieve: async id => ({ id, metadata: { cqaBusinessId: state.accountMismatch ? 'foreign-business' : ids.business }, charges_enabled: true, details_submitted: true }) },
    checkout: { sessions: {
      create: async (params, request) => {
        state.sessions.push({ params: clone(params), request: clone(request) });
        assert.ok(state.reservations.length, 'Inventory is reserved before creating a payable Stripe session');
        if (state.createError) throw Error('Private Stripe detail');
        const shipping = params.shipping_options?.[0]?.shipping_rate_data?.fixed_amount?.amount || 0;
        const session = { id: 'cs_merchant', url: state.missingUrl ? null : 'https://checkout.stripe.com/c/pay/cs_merchant', mode: params.mode, payment_status: 'paid', amount_subtotal: params.line_items[0].price_data.unit_amount, customer_details: { phone: '+61400000000' }, amount_total: params.line_items[0].price_data.unit_amount + shipping, currency: params.line_items[0].price_data.currency, payment_intent: 'pi_merchant', client_reference_id: params.client_reference_id, customer_email: 'payer-edited@example.test', metadata: clone(params.metadata), shipping_cost: { amount_total: shipping }, total_details: { amount_shipping: shipping }, shipping_details: { name: 'Verified recipient', address: { line1: '1 Example Street', city: 'Adelaide', postal_code: '5000', state: 'SA', country: 'AU' } } };
        state.createdSession = session; return clone(session);
      },
      retrieve: async (id, _params, request) => { state.retrieveCalls.push({ id, request }); return { ...clone(state.createdSession), ...clone(state.retrieveOverrides || {}) }; },
      expire: async (id, _params, request) => { state.expirations.push({ id, request }); if (state.expireError) throw Error('Stripe expire unavailable'); return { id, status: 'expired' }; }
    } },
    webhooks: { constructEvent: () => { if (state.badSignature) throw Error('Invalid signature'); return clone(state.event); } },
    paymentIntents: { retrieve: async (_id, _params, request) => {
      assert.equal(request.stripeAccount, 'acct_merchant');
      if (state.intentError) throw Error('Stripe unavailable');
      if (state.refundDuringSettlement) {
        state.refundDuringSettlement = false;
        const order = state.orders[0]; order.status = 'refunded'; order.buyer_user_id = null;
      }
      return { id: 'pi_merchant', status: state.unsettled ? 'processing' : 'succeeded', latest_charge: charge() };
    } }, charges: { retrieve: async () => charge() }
  };
  function charge() { return { id: 'ch_merchant', payment_intent: 'pi_merchant', amount: 5800, amount_refunded: state.partialRefund ? 2000 : 5800, refunded: !!state.refunded, disputed: !!state.disputed }; }
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports = {};
    new Function('require', 'exports', code)(name => {
      if (name === 'server-only') return {};
      if (name === 'next/server') return { NextResponse: { json: (body, options) => Response.json(body, options) } };
      if (name === '@/lib/cqa-supabase-admin') return { getCqaSupabaseAdmin: () => admin };
      if (name === '@/lib/stripe') return { getStripeClient: () => stripe };
      if (name === '@/lib/cqa-site-url') return { getCqaSiteUrl: () => 'https://shop.example.test' };
      if (name === '@/lib/cqa-launch-gate') return { isCqaPhysicalCheckoutAllowed: () => state.physicalGate, isCqaPhysicalPilotEnabled: () => state.physicalPilot, isCqaDigitalCheckoutAllowed: () => true, isNewCqaCheckoutAllowed: () => state.launchGate, CQA_PRELAUNCH_CHECKOUT_MESSAGE: 'Launch pending' };
      if (name === '@/lib/cqa-marketplace') return { platformFeePercent: () => 10, getPublicSupabaseClient: () => ({ rpc: async () => ({ data: [state.context], error: null }), auth: { getUser: async token => ({ data: { user: token === 'verified-buyer' ? state.user : null }, error: null }) } }) };
      if (name === '@/lib/cqa-billing') return { isActiveBillingStatus: value => value === 'active' };
      if (name === '@/lib/storage') return { verifyPrivateMarketplaceAsset: async () => true };
      if (name === '@/lib/cqa-automation-engine') return { triggerBusinessAutomations: async (...args) => { state.automations.push(args); } };
      if (name === '@/lib/cqa-transactional-email') return { notifyCqaOrder: async input => { state.notifications.push(input); if (state.emailError) throw Error('Email unavailable'); } };
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      return require(name);
    }, exports);
    cache.set(file, exports); return exports;
  }
  const checkout = load('app/api/marketplace/checkout/route.ts');
  const webhook = load('app/api/marketplace/stripe-webhook/route.ts');
  const helpers = load('lib/cqa-product-fulfillment.ts');
  const harness = { state, helpers, admin,
    checkout: (token = 'verified-buyer', extra = {}) => checkout.POST(new Request('https://shop.example.test/api/marketplace/checkout', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ machineSlug: 'merchant-store', offerId: ids.offer, ...extra }) })),
    send: (type = 'checkout.session.completed', overrides = {}, eventId = 'evt_merchant_' + state.webhookEvents.length, account = 'acct_merchant') => {
      const object = type.startsWith('checkout.') ? { ...clone(state.createdSession), ...overrides } : type === 'charge.dispute.created' ? { charge: 'ch_merchant', ...overrides } : { ...charge(), ...overrides };
      state.event = { id: eventId, type, account, livemode: state.livemode || false, data: { object } };
      return webhook.POST(new Request('https://shop.example.test/api/marketplace/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': 'fixture' }, body: '{}' }));
    }
  };
  return harness;
}
