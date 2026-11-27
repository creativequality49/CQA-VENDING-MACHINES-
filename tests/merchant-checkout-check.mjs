import assert from 'node:assert/strict';
import { merchantHarness, ids } from './helpers/merchant-harness.mjs';
async function test(name, run) { await run(); console.log('PASS ' + name); }
await test('physical checkout requires rollout approval and a verified buyer before reserving inventory', async () => {
  for (const [options, token, status] of [[{ physicalGate: false }, 'verified-buyer', 409], [{}, null, 401], [{ user: { is_anonymous: true } }, 'verified-buyer', 401], [{ user: { email_confirmed_at: null } }, 'verified-buyer', 401]]) {
    const h = merchantHarness(options); assert.equal((await h.checkout(token)).status, status); assert.equal(h.state.rpcCalls.length, 0); assert.equal(h.state.sessions.length, 0);
  }
});
await test('actual checkout reserves stock before Stripe and binds a buyer-owned pending order with immutable shipping totals', async () => {
  const h = merchantHarness(); const response = await h.checkout(); assert.equal(response.status, 200);
  assert.match((await response.json()).url, /^https:\/\/checkout\.stripe\.com\//);
  const created = h.state.sessions[0];
  assert.equal(created.request.stripeAccount, 'acct_merchant');
  assert.equal(created.request.idempotencyKey, `cqa-product-${ids.reservation}`);
  assert.ok(created.params.expires_at >= Math.floor(Date.now() / 1000) + 29 * 60);
  assert.deepEqual(created.params.shipping_address_collection.allowed_countries, ['AU']);
  assert.equal(created.params.shipping_options[0].shipping_rate_data.fixed_amount.amount, 900);
  assert.equal(created.params.shipping_options[0].shipping_rate_data.fixed_amount.currency, 'aud');
  assert.equal(created.params.metadata.cqaInventoryReservationId, ids.reservation);
  assert.equal(created.params.metadata.cqaPhysicalDelivery, '1');
  assert.equal(created.params.metadata.cqaBuyerUserId, ids.buyer);
  assert.equal(h.state.orders[0].amount_cents, 5800);
  assert.equal(h.state.orders[0].status, 'pending');
  assert.equal(h.state.orders[0].customer_user_id, ids.buyer);
  assert.equal(h.state.orders[0].purchase_snapshot.shipping.reservationId, ids.reservation);
  assert.equal(h.state.reservations[0].checkout, 'cs_merchant');
  assert.equal(h.state.reservations[0].order, ids.order);
});
await test('no second payable Checkout is created when the reservation RPC reports exhausted stock', async () => {
  const h = merchantHarness(); assert.equal((await h.checkout()).status, 200);
  assert.equal((await h.checkout()).status, 409);
  assert.equal(h.state.sessions.length, 1);
});
await test('catalogue price or shipping change under reservation lock fails closed before Stripe', async () => {
  for (const offer_snapshot of [{}, { title: 'Changed catalogue' }]) {
    const h = merchantHarness({ reservationOverrides: { offer_snapshot } });
    assert.equal((await h.checkout()).status, 409);
    assert.equal(h.state.sessions.length, 0);
    assert.equal(h.state.reservations[0].state, 'released');
  }
});
await test('ambiguous Stripe creation failure retains its hold and exposes no provider details', async () => {
  const h = merchantHarness({ createError: true }); const response = await h.checkout();
  assert.equal(response.status, 500); assert.equal(h.state.reservations[0].state, 'reserved');
  assert.ok(!(await response.text()).includes('Private Stripe'));
});
await test('pending ledger failure expires Checkout before releasing its unbound hold', async () => {
  const h = merchantHarness({ orderInsertError: true }); assert.equal((await h.checkout()).status, 503);
  assert.equal(h.state.expirations.length, 1); assert.equal(h.state.expirations[0].request.stripeAccount, 'acct_merchant');
  assert.equal(h.state.reservations[0].state, 'released'); assert.equal(h.state.orders.length, 0);
});
await test('failed Stripe expiry retains inventory instead of making a still-payable session oversell', async () => {
  const h = merchantHarness({ orderInsertError: true, expireError: true }); assert.equal((await h.checkout()).status, 503);
  assert.equal(h.state.reservations[0].state, 'reserved');
  assert.ok(!h.state.rpcCalls.some(call => call.name === 'cqa_release_inventory_reservation'));
});

await test('affiliate listings reject checkout without Stripe, a reservation or a CQA order', async () => {
  const h = merchantHarness({ offer: { offer_type: 'service', fulfillment_type: 'external', fulfilment_type: 'affiliate_link' }, context: { offer_type: 'service' } });
  const response = await h.checkout(null);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'CQA_AFFILIATE_EXTERNAL');
  assert.deepEqual([h.state.sessions.length,h.state.orders.length,h.state.reservations.length],[0,0,0]);
});
await test('supplier checkout requires isolated pilot and binds the one-unit SKU and shipping price on the order', async () => {
  const offer = { fulfilment_type: 'supplier_shipped', supplier_provider: 'mock', supplier_variant_sku: 'TEST-SKU', inventory_tracking: false, inventory_quantity: null };
  const closed = merchantHarness({ offer, physicalPilot: false });
  assert.equal((await closed.checkout()).status, 409);
  assert.equal(closed.state.sessions.length, 0);
  const h = merchantHarness({ offer });
  const response = await h.checkout('verified-buyer', { quantity: 99, shippingPriceCents: 1 });
  assert.equal(response.status, 200, await response.text());
  const checkout = h.state.sessions[0];
  assert.equal(checkout.params.line_items[0].quantity, 1);
  assert.equal(checkout.params.phone_number_collection.enabled, true);
  const snapshot = h.state.orders[0].purchase_snapshot;
  assert.equal(snapshot.sku, 'TEST-SKU');
  assert.equal(snapshot.fulfilmentType, 'supplier_shipped');
  assert.equal(snapshot.currency, 'aud');
  assert.equal(snapshot.unitPriceCents, 4900);
  assert.equal(snapshot.shipping.rateCents, 900);
  assert.equal(h.state.orders[0].amount_cents, 5800);
});
