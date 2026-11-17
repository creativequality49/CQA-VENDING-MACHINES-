import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';

const source = fs.readFileSync('lib/cqa-marketplace-buyer-binding.ts', 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function fixture(options = {}) {
  const order = { id: 'order', business_id: 'business', machine_id: 'machine', offer_id: 'offer', customer_user_id: 'buyer', buyer_user_id: 'buyer', amount_cents: 2900, currency: 'aud', stripe_checkout_session_id: 'checkout', status: 'pending', ...options.order };
  const session = { id: 'checkout', mode: 'payment', payment_status: 'paid', amount_total: 2900, currency: 'aud', client_reference_id: 'buyer', customer_email: 'different-payer@example.test', metadata: { cqaBusinessId: 'business', cqaMachineId: 'machine', cqaOfferId: 'offer', cqaBuyerUserId: 'buyer', ...options.metadata }, ...options.session };
  let reads = 0, identityReads = 0;
  const admin = { auth: { admin: { async getUserById(id) {
    identityReads++;
    assert.equal(id, 'buyer');
    return { data: { user: options.missingBuyer ? null : { id: options.wrongBuyer ? 'other' : 'buyer',
      email: options.noEmail ? null : options.buyerEmail ?? ' Verified-Account@example.test ',
      email_confirmed_at: options.unconfirmed ? null : 'confirmed', is_anonymous: !!options.anonymous } },
      error: options.identityError ? new Error('Identity unavailable') : null };
  } } }, from(table) {
    reads++;
    const filters = [];
    const q = { select() { return q; }, eq(key, value) { filters.push([key, value]); return q; },
      async maybeSingle() { assert.equal(table, 'cqa_orders'); assert.deepEqual(filters, [['stripe_checkout_session_id', session.id]]); return { data: options.missing ? null : order, error: options.readError ? new Error('ledger unavailable') : null }; },
      async single() { assert.equal(table, 'cqa_connected_accounts'); assert.deepEqual(filters, [['business_id', 'business']]); return { data: { stripe_account_id: options.account || 'seller' }, error: null }; } };
    return q;
  } };
  const verify = new Function('getCqaSupabaseAdmin', js + ';return verifyMarketplaceBuyerBinding;')(() => admin);
  return { run: () => verify({ account: options.eventAccount === undefined ? 'seller' : options.eventAccount }, session), reads: () => reads, identityReads: () => identityReads };
}

assert.deepEqual(await fixture().run(), { buyerUserId: 'buyer', buyerEmail: 'verified-account@example.test' });
assert.deepEqual(await fixture({ order: { customer_email: ' Verified-Account@example.test ' } }).run(), { buyerUserId: 'buyer', buyerEmail: 'verified-account@example.test' });
assert.deepEqual(await fixture({ order: { customer_email: 'changed-payer@example.test', status: 'paid' } }).run(), { buyerUserId: 'buyer', buyerEmail: 'verified-account@example.test' });
assert.deepEqual(await fixture({ session: { mode: 'subscription' } }).run(), { buyerUserId: 'buyer', buyerEmail: 'verified-account@example.test' });
assert.deepEqual(await fixture({ order: { customer_user_id: null } }).run(), { buyerUserId: 'buyer', buyerEmail: 'verified-account@example.test' });
for (const status of ['refunded', 'cancelled', 'disputed']) {
  assert.deepEqual(await fixture({ order: { status, buyer_user_id: null } }).run(), { buyerUserId: null });
  assert.deepEqual(await fixture({ order: { status, customer_user_id: null, buyer_user_id: null } }).run(), { buyerUserId: null });
}
for (const options of [
  { missing: true }, { readError: true }, { eventAccount: null }, { eventAccount: 'other' },
  { order: { customer_user_id: 'other' } }, { order: { customer_user_id: null, buyer_user_id: null } },
  { metadata: { cqaBuyerUserId: 'other' } }, { metadata: { cqaBusinessId: 'other' } },
  { metadata: { cqaMachineId: 'other' } }, { metadata: { cqaOfferId: 'other' } },
  { session: { client_reference_id: 'other' } }, { session: { amount_total: 1 } },
  { session: { currency: 'usd' } }, { session: { mode: 'setup' } },
  { identityError: true }, { missingBuyer: true }, { wrongBuyer: true }, { unconfirmed: true },
  { anonymous: true }, { noEmail: true }, { buyerEmail: ' ' },
]) await assert.rejects(fixture(options).run);
assert.equal(await fixture({ missing: true, session: { metadata: {}, client_reference_id: null } }).run(), null);
assert.equal(await fixture({ order: { customer_user_id: null, buyer_user_id: null }, session: { metadata: {}, client_reference_id: null } }).run(), null);
for (const options of [{ metadata: { cqaDigitalDelivery: '1' } }, { session: { payment_status: 'unpaid' } }]) {
  const f = fixture(options); assert.equal(await f.run(), null); assert.equal(f.reads(), 0);
}
console.log('PASS durable service buyer identity, subscription binding, anonymous checkout, payer-email independence, terminal revocation and contract mismatch rejection');
