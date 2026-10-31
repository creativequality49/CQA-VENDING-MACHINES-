import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = fs.readFileSync('app/api/marketplace/stripe-webhook/route.ts', 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'test-only';

function harness(options = {}) {
  const state = { orders: [], notifications: 0, automations: 0, finishes: [], contactStatus: null, providerCalls: 0, ...options };
  let event;
  function result(table, operation, payload, filters) {
    if (table === 'cqa_connected_accounts') return { data: { stripe_account_id: 'acct_test' }, error: null };
    if (table === 'cqa_contacts') {
      if (operation === 'upsert') { state.contactStatus = payload.status; return { data: { id: 'contact' }, error: null }; }
      return { data: { status: state.existingStatus || null }, error: null };
    }
    assert.equal(table, 'cqa_orders');
    if (state.dbError && operation !== 'select') return { data: null, error: Error('Database unavailable') };
    if (operation === 'upsert') {
      assert.equal(state.insertOptions.ignoreDuplicates, true, 'order creation must not overwrite existing orders');
      if (!state.orders.some(order => order.stripe_checkout_session_id === payload.stripe_checkout_session_id)) {
        state.orders.push({ id: 'order', ...payload });
      }
      return { data: null, error: null };
    }
    if (operation === 'update' && payload.status === 'paid' && state.concurrentRefund) {
      state.concurrentRefund = false;
      Object.assign(state.orders[0], { status: 'refunded', buyer_user_id: null });
    }
    const matches = state.orders.filter(order => filters.every(([kind, key, value]) => kind === 'eq' ? order[key] === value : order[key] !== value));
    if (operation === 'update') for (const order of matches) Object.assign(order, payload);
    return { data: matches.map(order => ({ ...order })), error: null };
  }
  const admin = {
    auth: { admin: { getUserById: async id => ({ data: { user: { id, email: state.buyerEmail || 'buyer@example.test', email_confirmed_at: state.unconfirmed ? null : 'confirmed' } }, error: null }) } },
    from(table) {
      let operation = 'select', payload, filters = [];
      const execute = () => Promise.resolve(result(table, operation, payload, filters));
      const one = async () => { const r = await execute(); return { ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data }; };
      const q = {
        select() { return q; },
        eq(key, value) { filters.push(['eq', key, value]); return q; },
        neq(key, value) { filters.push(['neq', key, value]); return q; },
        upsert(value, config) { operation = 'upsert'; payload = value; if (table === 'cqa_orders') state.insertOptions = config; return q; },
        update(value) { operation = 'update'; payload = value; return q; },
        maybeSingle: one, single: one,
        then(resolve, reject) { return execute().then(resolve, reject); }
      };
      return q;
    }
  };
  const charge = () => ({ id: 'ch_test', payment_intent: 'pi_test', amount: 12000, amount_refunded: state.partialRefund ? 3000 : 12000, refunded: !!state.currentRefund, disputed: !!state.currentDispute });
  const stripe = {
    webhooks: { constructEvent: () => { if (state.badSignature) throw Error('Invalid signature'); return event; } },
    invoices: { retrieve: async (id, _params, request) => {
      assert.equal(id, 'in_original', 'only original Checkout invoice may be inspected');
      assert.equal(request.stripeAccount, 'acct_test');
      state.invoiceCalls = (state.invoiceCalls || 0) + 1;
      if (state.invoiceError) throw Error('Invoice unavailable');
      return { id, paid: true, status: 'paid', subscription: 'sub_test', customer: 'cus_test', currency: 'aud', total: 12000, payment_intent: 'pi_test', ...state.invoiceOverrides };
    } },
    paymentIntents: { retrieve: async (_id, _params, request) => {
      state.providerCalls++;
      assert.equal(request.stripeAccount, 'acct_test');
      assert.equal(state.orders.length, 1, 'pending row exists before provider inspection');
      assert.equal(state.orders[0].status === 'pending' || state.orders[0].status === 'paid' || ['refunded', 'cancelled'].includes(state.orders[0].status), true);
      if (state.providerError) throw Error('Stripe unavailable');
      return { status: state.unsettled ? 'processing' : 'succeeded', latest_charge: state.unexpanded ? 'ch_test' : charge() };
    } },
    charges: { retrieve: async () => charge() }
  };
  const post = new Function('NextResponse', 'getStripeClient', 'getCqaSupabaseAdmin', 'triggerBusinessAutomations', 'claimCqaWebhookEvent', 'finishCqaWebhookEvent', 'notifyCqaOrder', compiled + ';return POST;')(
    { json: (body, config) => ({ body, status: config?.status || 200 }) }, () => stripe, () => admin,
    async () => { state.automations++; },
    async () => ({ duplicate: !!state.duplicate, claimedAt: 'lease' }),
    async (id, _claim, error) => { state.finishes.push({ id, error }); },
    async () => { state.notifications++; if (state.emailError) throw Error('Email unavailable'); }
  );
  return {
    state,
    async send(type = 'checkout.session.completed', object = {}) {
      const session = { id: 'cs_test', mode: state.subscription ? 'subscription' : 'payment', invoice: state.subscription ? 'in_original' : null, subscription: state.subscription ? 'sub_test' : null, customer: 'cus_test', payment_status: 'paid', amount_total: 12000, currency: 'aud', payment_intent: state.subscription ? null : 'pi_test', customer_email: 'buyer@example.test', metadata: { cqaBusinessId: 'business', cqaMachineId: 'machine', cqaOfferId: 'offer', cqaBuyerUserId: 'buyer-user' } };
      event = { id: 'evt_' + state.finishes.length, type, account: state.mismatch ? 'acct_wrong' : 'acct_test', data: { object: { ...(type.startsWith('checkout.') ? session : type === 'charge.dispute.created' ? { charge: 'ch_test' } : charge()), ...object } } };
      return post(new Request('http://localhost/webhook', { method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}' }));
    }
  };
}
async function test(name, run) { await run(); console.log('PASS ' + name); }

await test('unpaid checkout cannot create entitlement', async () => {
  const h = harness(); assert.equal((await h.send(undefined, { payment_status: 'unpaid' })).status, 200); assert.equal(h.state.orders.length, 0);
});
await test('paid checkout creates account-bound order and preserves opt-out', async () => {
  const h = harness(); assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'paid'); assert.equal(h.state.orders[0].buyer_user_id, 'buyer-user'); assert.equal(h.state.contactStatus, 'unsubscribed'); assert.equal(h.state.notifications, 1); assert.equal(h.state.automations, 1);
});
await test('existing contact consent is preserved', async () => {
  const h = harness({ existingStatus: 'subscribed' }); await h.send(); assert.equal(h.state.contactStatus, 'subscribed');
});
await test('duplicate event does not mutate or notify', async () => {
  const h = harness({ duplicate: true }); await h.send(); assert.equal(h.state.orders.length, 0); assert.equal(h.state.notifications, 0);
});
await test('receipt failure remains retryable', async () => {
  const h = harness({ emailError: true }); assert.equal((await h.send()).status, 500); assert.ok(h.state.finishes[0].error); h.state.emailError = false; assert.equal((await h.send()).status, 200); assert.equal(h.state.orders.length, 1);
});
await test('database failure remains retryable without grant', async () => {
  const h = harness({ dbError: true }); assert.equal((await h.send()).status, 500); assert.ok(h.state.finishes[0].error); assert.equal(h.state.orders.length, 0);
});
await test('account mismatch prevents provider or order work', async () => {
  const h = harness({ mismatch: true }); assert.equal((await h.send()).status, 500); assert.equal(h.state.orders.length, 0); assert.equal(h.state.providerCalls, 0);
});
await test('provider failure leaves pending row and no receipt', async () => {
  const h = harness({ providerError: true }); assert.equal((await h.send()).status, 500); assert.equal(h.state.orders[0].status, 'pending'); assert.equal(h.state.notifications, 0);
});
await test('unsettled current payment cannot grant access', async () => {
  const h = harness({ unsettled: true }); assert.equal((await h.send()).status, 500); assert.equal(h.state.orders[0].status, 'pending');
});
await test('refunded current charge arriving before completion never grants access', async () => {
  const h = harness({ currentRefund: true }); assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'refunded'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 0);
});
await test('disputed current charge uses supported cancelled status and no access', async () => {
  const h = harness({ currentDispute: true }); assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'cancelled'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 0);
});
await test('distinct delayed completion after full refund cannot restore access', async () => {
  const h = harness(); await h.send(); h.state.currentRefund = true; await h.send('charge.refunded'); assert.equal(h.state.orders[0].status, 'refunded'); h.state.currentRefund = false; assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'refunded'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 1);
});
await test('distinct delayed async completion after dispute cannot restore access', async () => {
  const h = harness(); await h.send(); h.state.currentDispute = true; await h.send('charge.dispute.created'); assert.equal(h.state.orders[0].status, 'cancelled'); h.state.currentDispute = false; await h.send('checkout.session.async_payment_succeeded'); assert.equal(h.state.orders[0].status, 'cancelled'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 1);
});
await test('concurrent refund between provider inspection and paid write wins', async () => {
  const h = harness({ concurrentRefund: true }); await h.send(); assert.equal(h.state.orders[0].status, 'refunded'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 0);
});
await test('partial refund retains existing paid access', async () => {
  const h = harness(); await h.send(); h.state.partialRefund = true; await h.send('charge.refunded', { refunded: false }); assert.equal(h.state.orders[0].status, 'paid'); assert.equal(h.state.orders[0].buyer_user_id, 'buyer-user');
});
await test('expiration only cancels pending orders, not paid or revoked orders', async () => {
  const h = harness(); await h.send(); await h.send('checkout.session.expired'); assert.equal(h.state.orders[0].status, 'paid'); h.state.currentRefund = true; await h.send('charge.refunded'); await h.send('checkout.session.expired'); assert.equal(h.state.orders[0].status, 'refunded'); h.state.orders[0].status = 'pending'; await h.send('checkout.session.expired'); assert.equal(h.state.orders[0].status, 'cancelled');
});
await test('unexpanded latest charge is retrieved before fulfilment', async () => {
  const h = harness({ unexpanded: true, currentRefund: true }); await h.send(); assert.equal(h.state.orders[0].status, 'refunded');
});
await test('zero-value checkout without payment is still supported', async () => {
  const h = harness(); await h.send(undefined, { payment_status: 'no_payment_required', amount_total: 0, payment_intent: null }); assert.equal(h.state.orders[0].status, 'paid'); assert.equal(h.state.providerCalls, 0);
});
await test('missing paid payment intent fails closed', async () => {
  const h = harness(); assert.equal((await h.send(undefined, { payment_intent: null })).status, 500); assert.equal(h.state.orders[0].status, 'pending');
});
await test('unverified or mismatched buyer email never binds another account', async () => {
  for (const options of [{ unconfirmed: true }, { buyerEmail: 'other@example.test' }]) { const h = harness(options); await h.send(); assert.equal(h.state.orders[0].buyer_user_id, null); }
});
await test('invalid signature cannot reach database', async () => {
  const h = harness({ badSignature: true }); assert.equal((await h.send()).status, 400); assert.equal(h.state.orders.length, 0);
});
await test('paid subscription resolves its original invoice payment intent', async () => {
  const h = harness({ subscription: true }); assert.equal((await h.send()).status, 200); assert.equal(h.state.invoiceCalls, 1); assert.equal(h.state.orders[0].stripe_payment_intent_id, 'pi_test'); assert.equal(h.state.orders[0].status, 'paid'); assert.equal(h.state.orders[0].buyer_user_id, 'buyer-user');
});
await test('refunded original subscription invoice cannot grant access', async () => {
  const h = harness({ subscription: true, currentRefund: true }); assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'refunded'); assert.equal(h.state.orders[0].buyer_user_id, null); assert.equal(h.state.notifications, 0);
});
await test('disputed original subscription invoice cannot grant access', async () => {
  const h = harness({ subscription: true, currentDispute: true }); assert.equal((await h.send()).status, 200); assert.equal(h.state.orders[0].status, 'cancelled'); assert.equal(h.state.notifications, 0);
});
await test('unpaid or mismatched subscription invoice fails before order work', async () => {
  for (const invoiceOverrides of [{ paid: false }, { status: 'open' }, { subscription: 'sub_other' }, { customer: 'cus_other' }, { currency: 'usd' }, { total: 100 }]) {
    const h = harness({ subscription: true, invoiceOverrides }); assert.equal((await h.send()).status, 500); assert.equal(h.state.orders.length, 0); assert.equal(h.state.notifications, 0);
  }
});
await test('subscription invoice provider failure is retryable', async () => {
  const h = harness({ subscription: true, invoiceError: true }); assert.equal((await h.send()).status, 500); assert.ok(h.state.finishes[0].error); assert.equal(h.state.orders.length, 0); h.state.invoiceError = false; assert.equal((await h.send()).status, 200);
});
await test('subscription checkout missing its original invoice fails closed', async () => {
  const h = harness({ subscription: true }); assert.equal((await h.send(undefined, { invoice: null })).status, 500); assert.equal(h.state.orders.length, 0);
});
