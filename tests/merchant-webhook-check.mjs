import assert from 'node:assert/strict';
import { merchantHarness,ids } from './helpers/merchant-harness.mjs';
process.env.STRIPE_CONNECT_WEBHOOK_SECRET='whsec_local_fixture';
async function test(name,run){await run();console.log('PASS '+name);}
await test('signed physical payment retrieves its Connect checkout and creates durable fulfilment before receipt',async()=>{
 const h=merchantHarness();assert.equal((await h.checkout()).status,200);const response=await h.send();assert.equal(response.status,200,await response.text());
 assert.equal(h.state.orders[0].status,'paid');assert.equal(h.state.commits,1);assert.equal(h.state.fulfillment.shipment.state,'ready');assert.equal(h.state.fulfillment.job.kind,'physical_shipment');
 assert.equal(h.state.notifications.length,1);assert.equal(h.state.notifications[0].buyerEmail,'buyer@example.test');assert.equal(h.state.retrieveCalls[0].request.stripeAccount,'acct_merchant');
 assert(h.state.rpcCalls.some(c=>c.name==='cqa_record_product_fulfillment'));
});
await test('distinct completion events for one checkout cannot debit inventory or create shipment twice',async()=>{
 const h=merchantHarness();await h.checkout();assert.equal((await h.send()).status,200);assert.equal((await h.send('checkout.session.completed',{},'evt_second_delivery')).status,200);assert.equal(h.state.commits,1);assert.equal(h.state.orders.length,1);
});
await test('physical payment rejects amount, buyer, country, reservation and account mismatches before fulfilment',async()=>{
 for(const overrides of [{amount_total:1},{client_reference_id:'outsider'},{metadata:{cqaPhysicalDelivery:'1',cqaInventoryReservationId:ids.reservation}},{shipping_details:{name:'Wrong region',address:{line1:'A',city:'B',postal_code:'C',country:'US'}}}]){
  const h=merchantHarness({retrieveOverrides:overrides});await h.checkout();assert.equal((await h.send()).status,500);assert.equal(h.state.fulfillment,undefined);assert.equal(h.state.notifications.length,0);
 }
 const h=merchantHarness();await h.checkout();assert.equal((await h.send('checkout.session.completed',{},'evt_foreign','acct_outsider')).status,500);assert.equal(h.state.notifications.length,0);
});
await test('receipt failure can retry without consuming stock or creating another shipment',async()=>{
 const h=merchantHarness({emailError:true});await h.checkout();assert.equal((await h.send()).status,500);assert.equal(h.state.commits,1);h.state.emailError=false;assert.equal((await h.send('checkout.session.completed',{},'evt_receipt_retry')).status,200);assert.equal(h.state.commits,1);
});
await test('provider expiry/failure releases a hold only on the owning Connect account',async()=>{
 const h=merchantHarness();await h.checkout();assert.equal((await h.send('checkout.session.expired',{},'evt_wrong_expiry','acct_foreign')).status,500);assert.equal(h.state.reservations[0].state,'reserved');
 assert.equal((await h.send('checkout.session.expired',{},'evt_expiry')).status,200);assert.equal(h.state.reservations[0].state,'released');assert.equal(h.state.orders[0].status,'cancelled');assert.equal(h.state.notifications.length,0);
});
await test('unsettled payments and refunded charges cannot produce shipment or receipts',async()=>{
 for(const options of [{unsettled:true},{refunded:true}]){const h=merchantHarness(options);await h.checkout();const response=await h.send();assert.equal(response.status,options.refunded?200:500);assert.equal(h.state.fulfillment,undefined);assert.equal(h.state.notifications.length,0);}
 const h=merchantHarness();await h.checkout();assert.equal((await h.send('checkout.session.completed',{payment_status:'unpaid'})).status,200);assert.equal(h.state.fulfillment,undefined);assert.equal((await h.send('checkout.session.async_payment_succeeded',{},'evt_async_success')).status,200);assert.equal(h.state.commits,1);
});

const supplierOffer = { fulfilment_type: 'supplier_shipped', supplier_provider: 'mock', supplier_variant_sku: 'TEST-SKU', inventory_tracking: false, inventory_quantity: null };
await test('supplier payment produces one approval record after webhook replays without dispatch or email', async () => {
  const h = merchantHarness({ offer: supplierOffer });
  assert.equal((await h.checkout()).status,200);
  assert.equal(h.state.supplierFulfillment,undefined);
  for (const eventId of ['evt_supplier','evt_supplier','evt_supplier_replayed']) {
    const response = await h.send('checkout.session.completed',{},eventId);
    assert.equal(response.status,200,await response.text());
  }
  assert.equal(h.state.commits,1);
  assert.equal(h.state.orders.length,1);
  assert.deepEqual(h.state.supplierFulfillment,{ orderId: ids.order,provider: 'mock',sku: 'TEST-SKU',status: 'awaiting_approval' });
  assert.equal(h.state.notifications.length,0);
  assert.equal(h.state.automations.length,0);
});
await test('supplier webhook rejects live payment and missing verified shipping contact', async () => {
  for (const invalid of [{livemode:true},{retrieveOverrides:{customer_details:{phone:null}}}]) {
    const h = merchantHarness({ offer: supplierOffer, ...invalid });
    assert.equal((await h.checkout()).status,200);
    assert.equal((await h.send()).status,500);
    assert.equal(h.state.supplierFulfillment,undefined);
  }
});
