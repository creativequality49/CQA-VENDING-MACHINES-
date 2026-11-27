import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const id = '10000000-0000-4000-8000-000000000001';
const job = { state: 'awaiting_approval', revision: 0, provider: 'mock', variant_sku: 'sku',
  approval_quote: null, supplier_order_id: null, supplier_payment_state: 'unpaid' };
let quote = { stock: 2, totalCost: 800, currency: 'aud', variantId: 'private-id', shippingCost: 100 };
let status = 'paid', refunded = false, responseLost = false, sent = 0, privilegedReads = 0;
const reject = (status, message) => { throw Object.assign(new Error(message), { status }); };
const query = (data) => ({ select() { return this; }, eq() { return this; },
  async single() { return { data }; }, async maybeSingle() { return { data }; } });
const admin = {
  from(table) {
    if (table === 'cqa_supplier_fulfilments') { privilegedReads++; return query(structuredClone(job)); }
    if (table === 'cqa_order_shipments') return query({ shipping_address: {
      name: 'Fixture', line1: '1 Fixture Street', city: 'Adelaide', state: 'SA', postal_code: '5000', country: 'AU' } });
    if (table === 'cqa_orders') return query({ stripe_payment_intent_id: 'pi_fixture' });
    if (table === 'cqa_connected_accounts') return query({ stripe_account_id: 'acct_fixture' });
    throw Error('Unexpected table');
  },
  async rpc(name, input) {
    if (name === 'cqa_supplier_approval') {
      const changed = JSON.stringify(job.approval_quote) !== JSON.stringify(input.p_quote);
      if (changed) Object.assign(job, { approval_quote: input.p_quote, revision: job.revision + 1 });
      else if (input.p_action === 'approve' && quote.stock > 0) Object.assign(job, { state: 'submitting', revision: job.revision + 1 });
      return { data: { job, changed } };
    }
    assert.equal(name, 'cqa_supplier_submission_result');
    Object.assign(job, { state: input.p_reference ? 'submitted' : 'reconciliation_required',
      supplier_order_id: input.p_reference, revision: job.revision + 1 });
    return { data: job };
  }
};
const deps = {
  '@/lib/cqa-launch-gate': { isCqaPhysicalPilotEnabled: () => true },
  '@/lib/cqa-owner-auth': { requireCqaOwner: async () => ({ user: { id: 'seller' }, business: { id: 'shop' }, admin: {} }) },
  '@/lib/cqa-owner-orders': {
    orderFailure: reject, requestBusinessId: () => 'shop', ownerOrderHeaders: {},
    ownerOrder: async (_, orderId) => { if (orderId !== id) reject(404, 'Order unavailable'); return { status }; },
    safeOwnerOrderError: error => ({ status: error.status || 503, error: error.status ? error.message : 'Unavailable' })
  },
  '@/lib/cqa-supabase-admin': { getCqaSupabaseAdmin: () => admin },
  '@/lib/stripe': { getStripeClient: () => ({ paymentIntents: { retrieve: async () => ({
    livemode: false, status: 'succeeded', latest_charge: { paid: true, amount_refunded: refunded ? 1 : 0 }
  }) } }) },
  '@/lib/cqa-supplier': { getSupplierAdapter: () => ({
    quote: async () => quote,
    submit: async ({ reference }) => {
      ++sent;
      assert.equal(reference, id);
      if (responseLost) throw Error('provider response unavailable');
      return { supplierReference: 'mock-reference' };
    },
    reconcile: async () => ({ supplierReference: 'mock-reference' })
  }) }
};
const result = {};
const code = ts.transpileModule(readFileSync('app/api/owner/orders/[orderId]/supplier/route.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
new Function('require', 'exports', code)(name => deps[name] || require(name), result);
const route = (orderId = id) => ({ params: Promise.resolve({ orderId }) });
const req = (action, revision = job.revision) => new Request('https://preview.example.test/supplier', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, revision })
});
assert.equal((await result.GET(new Request('https://preview.example.test/supplier'), route('foreign'))).status, 404);
assert.equal((await result.POST(req('approve'), route('foreign'))).status, 404);
assert.equal(privilegedReads, 0);
const initial = await (await result.POST(req('quote'), route())).json();
assert.equal(initial.supplier.quote.totalCost, 800);
assert.equal(initial.supplier.quote.variantId, undefined);
assert.equal(initial.supplier.quote.shippingCost, undefined);
quote = { ...quote, stock: 1, totalCost: 900 };
const changed = await (await result.POST(req('approve'), route())).json();
assert.equal(changed.previousQuote.totalCost, 800);
assert.equal(changed.supplier.quote.totalCost, 900);
assert.equal(sent, 0);
assert.equal((await result.POST(req('approve', 1), route())).status, 409);
refunded = true;
assert.equal((await result.POST(req('approve'), route())).status, 409);
assert.equal(sent, 0);
refunded = false;
status = 'refunded';
assert.equal((await result.POST(req('approve'), route())).status, 409);
assert.equal(sent, 0);
status = 'paid';
responseLost = true;
const pending = await (await result.POST(req('approve'), route())).json();
assert.equal(pending.supplier.state, 'reconciliation_required');
assert.equal((await result.POST(req('approve'), route())).status, 409);
const reconciled = await (await result.POST(req('reconcile'), route())).json();
assert.equal(reconciled.supplier.supplierReference, 'mock-reference');
assert.equal(sent, 1);
console.log('PASS supplier approval route: ownership, quote changes, refunds and ambiguous submission');
